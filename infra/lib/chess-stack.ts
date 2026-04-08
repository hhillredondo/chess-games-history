import * as path from "path";

import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

export interface ChessStatsStackProps extends cdk.StackProps {
  envName: "dev" | "prod";
}

export class ChessStatsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ChessStatsStackProps) {
    super(scope, id, props);

    const { envName } = props;
    const prefix = `chess-stats-${envName}`;

    // ── S3 bucket (private; only CloudFront via OAC can read it) ─────────────

    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      // Destroy dev buckets automatically; retain prod buckets on stack deletion
      removalPolicy:
        envName === "dev" ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: envName === "dev",
    });

    // ── Lambda API (no VPC — public egress to Chess.com / Lichess) ───────────

    const apiFunction = new nodejs.NodejsFunction(this, "ApiFunction", {
      functionName: `${prefix}-api`,
      // Entry is the Lambda handler; esbuild bundles all transitive imports
      entry: path.join(__dirname, "../../src/lambda/games-handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      // No vpc property → Lambda uses public internet by default (no NAT Gateway)
      bundling: {
        minify: true,
        sourceMap: false,
        target: "node20",
        // Point esbuild at the lambda-specific tsconfig so it can resolve @/ path aliases
        tsconfig: path.join(__dirname, "../../tsconfig.lambda.json"),
        // chess.js and all other non-AWS deps are bundled (Lambda doesn't provide them)
        externalModules: ["@aws-sdk/*"],
      },
    });

    // Lambda Function URL — no IAM auth; CloudFront is the public entry point
    const fnUrl = apiFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.GET],
        allowedHeaders: ["*"],
      },
    });

    // Extract the bare domain from https://<domain>/ for use as a CloudFront origin
    const fnUrlDomain = cdk.Fn.select(2, cdk.Fn.split("/", fnUrl.url));

    // ── CloudFront ────────────────────────────────────────────────────────────

    // Rewrite extensionless paths to /index.html so that direct loads of Next.js
    // routes (e.g. /games) resolve to the correct static file in S3.
    // Without this, S3 returns 403 for /games because the object is stored at
    // games/index.html, not games.
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

    // S3 origin with Origin Access Control (OAC) — more secure than legacy OAI
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(siteBucket);

    // Lambda Function URL origin; ALL_VIEWER_EXCEPT_HOST_HEADER forwards query
    // strings and headers but replaces Host with the Lambda URL domain
    const apiOrigin = new origins.HttpOrigin(fnUrlDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `${prefix}`,
      // Serve index.html for the root path
      defaultRootObject: "index.html",
      // PriceClass_100 = US + Europe + Asia — cheapest tier
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,

      // Default behaviour: static assets from S3
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
        // /api/* routed to Lambda Function URL; query strings forwarded, no caching
        "/api/*": {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          // Forward all query strings + headers (except Host) to Lambda
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },

      // SPA routing: unknown paths serve index.html so the client router takes over
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

    // ── Deploy static Next.js export to S3, invalidate CloudFront ────────────

    new s3deploy.BucketDeployment(this, "SiteDeploy", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../out"))],
      destinationBucket: siteBucket,
      // Invalidate the whole distribution after upload so stale assets are purged
      distribution,
      distributionPaths: ["/*"],
      // Run the deployment Lambda in the same region
      memoryLimit: 512,
    });

    // ── Outputs ───────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, "SiteUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "CloudFront URL for the app",
    });

    new cdk.CfnOutput(this, "LambdaUrl", {
      value: fnUrl.url,
      description: "Raw Lambda Function URL (normally accessed via CloudFront /api/*)",
    });

    new cdk.CfnOutput(this, "S3Bucket", {
      value: siteBucket.bucketName,
      description: "S3 bucket holding the static site",
    });
  }
}
