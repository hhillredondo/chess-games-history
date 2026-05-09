import * as path from "path";

import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface ChessStatsStackProps extends cdk.StackProps {
  envName: "dev" | "prod";
}

export class ChessStatsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ChessStatsStackProps) {
    super(scope, id, props);

    const { envName } = props;
    const prefix = `chess-stats-${envName}`;
    const removalPolicy =
      envName === "dev" ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN;
    const autoDelete = envName === "dev";

    // ── Static site bucket ───────────────────────────────────────────────────

    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy,
      autoDeleteObjects: autoDelete,
    });

    // ── Cache bucket (game shards) ───────────────────────────────────────────

    const cacheBucket = new s3.Bucket(this, "CacheBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy,
      autoDeleteObjects: autoDelete,
      // Backstop in case the cleanup Lambda misses entries.
      lifecycleRules: [
        {
          id: "cache-ttl-backstop",
          expiration: cdk.Duration.days(45),
        },
      ],
    });

    // ── Cache metadata table ─────────────────────────────────────────────────

    const cacheTable = new dynamodb.Table(this, "CacheTable", {
      tableName: `${prefix}-cache-meta`,
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    });

    // ── Common Lambda bundling config ────────────────────────────────────────

    const commonBundling: nodejs.BundlingOptions = {
      minify: true,
      sourceMap: false,
      target: "node20",
      tsconfig: path.join(__dirname, "../../tsconfig.lambda.json"),
      // AWS SDK clients live in the Node 20 runtime; chess.js gets bundled.
      externalModules: ["@aws-sdk/*"],
    };

    // Pin the deps lockfile to the repo root so CDK mounts the whole project
    // into the esbuild Docker container. Without this, CDK picks
    // infra/package-lock.json as the root and can't see src/lambda or
    // tsconfig.lambda.json.
    const repoLockFile = path.join(__dirname, "../../package-lock.json");

    // ── Ingest worker Lambda (long timeout, self-invokes) ────────────────────

    // Pre-compute the worker's name + ARN as static strings so we can grant
    // self-invoke permission without creating a CFN dependency from the
    // worker's role policy back to the worker itself (which would cycle).
    const workerFunctionName = `${prefix}-ingest-worker`;
    const workerFunctionArn = cdk.Stack.of(this).formatArn({
      service: "lambda",
      resource: "function",
      resourceName: workerFunctionName,
      arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
    });

    const workerFunction = new nodejs.NodejsFunction(this, "IngestWorker", {
      functionName: workerFunctionName,
      entry: path.join(__dirname, "../../src/lambda/ingest-worker.ts"),
      depsLockFilePath: repoLockFile,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
      bundling: commonBundling,
      environment: {
        CACHE_BUCKET: cacheBucket.bucketName,
        CACHE_TABLE: cacheTable.tableName,
        WORKER_FUNCTION_NAME: workerFunctionName,
        MAX_GAMES_PER_USER: "50000",
      },
    });

    cacheBucket.grantReadWrite(workerFunction);
    cacheTable.grantReadWriteData(workerFunction);
    workerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [workerFunctionArn],
      })
    );

    // ── Cache API Lambda (synchronous reads + worker kickoff) ────────────────

    const cacheFunction = new nodejs.NodejsFunction(this, "CacheApiFunction", {
      functionName: `${prefix}-cache-api`,
      entry: path.join(__dirname, "../../src/lambda/cache-handler.ts"),
      depsLockFilePath: repoLockFile,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      bundling: commonBundling,
      environment: {
        CACHE_BUCKET: cacheBucket.bucketName,
        CACHE_TABLE: cacheTable.tableName,
        WORKER_FUNCTION_NAME: workerFunctionName,
      },
    });

    cacheBucket.grantRead(cacheFunction);
    cacheBucket.grantDelete(cacheFunction);
    cacheTable.grantReadWriteData(cacheFunction);
    cacheFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [workerFunctionArn],
      })
    );

    const cacheFnUrl = cacheFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.GET, lambda.HttpMethod.POST],
        allowedHeaders: ["*"],
      },
    });
    const cacheFnUrlDomain = cdk.Fn.select(2, cdk.Fn.split("/", cacheFnUrl.url));

    // ── Legacy direct-fetch API (kept for backwards compatibility) ───────────

    const apiFunction = new nodejs.NodejsFunction(this, "ApiFunction", {
      functionName: `${prefix}-api`,
      entry: path.join(__dirname, "../../src/lambda/games-handler.ts"),
      depsLockFilePath: repoLockFile,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      bundling: commonBundling,
    });

    const fnUrl = apiFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.GET],
        allowedHeaders: ["*"],
      },
    });
    const fnUrlDomain = cdk.Fn.select(2, cdk.Fn.split("/", fnUrl.url));

    // ── AI Coach Lambda (Anthropic-backed, streaming SSE) ────────────────────
    //
    // The Anthropic API key is stored in AWS Secrets Manager at:
    //   /chess-stats/{env}/anthropic-api-key
    //
    // Create/update with:
    //   aws secretsmanager create-secret --name /chess-stats/dev/anthropic-api-key --secret-string "sk-ant-..."
    //   aws secretsmanager update-secret --secret-id /chess-stats/dev/anthropic-api-key --secret-string "sk-ant-..."

    const secretName = `/chess-stats/${envName}/anthropic-api-key`;
    const coachSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "CoachApiKeySecret",
      secretName
    );

    const coachFunction = new nodejs.NodejsFunction(this, "CoachFunction", {
      functionName: `${prefix}-coach`,
      entry: path.join(__dirname, "../../src/lambda/coach-handler.ts"),
      depsLockFilePath: repoLockFile,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      // Anthropic streams can take tens of seconds for long coaching responses.
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      bundling: commonBundling,
      environment: {
        ANTHROPIC_API_KEY: coachSecret.secretValue.unsafeUnwrap(),
      },
    });

    const coachFnUrl = coachFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      // RESPONSE_STREAM is required for the SSE output mode used by coach-handler.
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ["*"],
      },
    });
    const coachFnUrlDomain = cdk.Fn.select(2, cdk.Fn.split("/", coachFnUrl.url));

    // ── Cleanup Lambda (nightly TTL + capacity sweep) ────────────────────────

    const cleanupFunction = new nodejs.NodejsFunction(this, "CleanupFunction", {
      functionName: `${prefix}-cleanup`,
      entry: path.join(__dirname, "../../src/lambda/cleanup-handler.ts"),
      depsLockFilePath: repoLockFile,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      bundling: commonBundling,
      environment: {
        CACHE_BUCKET: cacheBucket.bucketName,
        CACHE_TABLE: cacheTable.tableName,
        CACHE_TTL_DAYS: "30",
        MAX_TOTAL_GAMES: "5000000",
      },
    });

    cacheBucket.grantReadWrite(cleanupFunction);
    cacheBucket.grantDelete(cleanupFunction);
    cacheTable.grantReadWriteData(cleanupFunction);

    new events.Rule(this, "CleanupSchedule", {
      ruleName: `${prefix}-cleanup-daily`,
      schedule: events.Schedule.cron({ minute: "0", hour: "4" }),
      targets: [new targets.LambdaFunction(cleanupFunction)],
    });

    // ── CloudFront ────────────────────────────────────────────────────────────

    const rewriteFn = new cloudfront.Function(this, "RewriteIndexHtml", {
      functionName: `${prefix}-rewrite-index`,
      code: cloudfront.FunctionCode.fromInline(
        [
          "function handler(event) {",
          "  var uri = event.request.uri;",
          "  if (uri === '/') return event.request;",
          "  var last = uri.split('/').pop();",
          "  if (last !== undefined && !last.includes('.')) {",
          "    event.request.uri = uri.replace(/\\/$/, '') + '.html';",
          "  }",
          "  return event.request;",
          "}",
        ].join("\n")
      ),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(siteBucket);

    const apiOrigin = new origins.HttpOrigin(fnUrlDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      readTimeout: cdk.Duration.seconds(60),
    });

    const cacheApiOrigin = new origins.HttpOrigin(cacheFnUrlDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      readTimeout: cdk.Duration.seconds(30),
    });

    const coachApiOrigin = new origins.HttpOrigin(coachFnUrlDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      // Coach responses can run for ~1m on long follow-ups; allow generous headroom.
      readTimeout: cdk.Duration.seconds(60),
    });

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `${prefix}`,
      defaultRootObject: "index.html",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,

      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        functionAssociations: [
          {
            function: rewriteFn,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },

      additionalBehaviors: {
        // Cache API takes precedence (more specific).
        "/api/cache*": {
          origin: cacheApiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
        // Coach API — streams SSE from Lambda to the browser via CloudFront.
        "/api/coach*": {
          origin: coachApiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
        "/api/*": {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },

      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
      ],
    });

    // ── Deploy static site ───────────────────────────────────────────────────

    new s3deploy.BucketDeployment(this, "SiteDeploy", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../dist"))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
      memoryLimit: 512,
    });

    // ── Outputs ──────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, "SiteUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "CloudFront URL for the app",
    });
    new cdk.CfnOutput(this, "LambdaUrl", {
      value: fnUrl.url,
      description: "Raw direct-fetch Lambda Function URL",
    });
    new cdk.CfnOutput(this, "CacheLambdaUrl", {
      value: cacheFnUrl.url,
      description: "Raw cache Lambda Function URL",
    });
    new cdk.CfnOutput(this, "CoachLambdaUrl", {
      value: coachFnUrl.url,
      description: "Raw coach Lambda Function URL (streams SSE)",
    });
    new cdk.CfnOutput(this, "S3Bucket", {
      value: siteBucket.bucketName,
      description: "S3 bucket holding the static site",
    });
    new cdk.CfnOutput(this, "CacheBucketName", {
      value: cacheBucket.bucketName,
      description: "S3 bucket holding game cache shards",
    });
    new cdk.CfnOutput(this, "CacheTableName", {
      value: cacheTable.tableName,
      description: "DynamoDB table holding cache metadata",
    });
  }
}
