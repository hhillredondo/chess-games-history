import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface GithubOidcStackProps extends cdk.StackProps {
  /** GitHub repo in `owner/repo` form, e.g. `AlphaAnimal/chess-games-history`. */
  githubRepo: string;
  /**
   * Refs allowed to assume this role. Defaults to the main branch only.
   * Each entry is a `sub` claim StringLike pattern, e.g.
   * `repo:AlphaAnimal/chess-games-history:ref:refs/heads/main`.
   */
  allowedRefs?: string[];
}

/**
 * One-time stack that creates the GitHub OIDC provider (if missing) and a
 * deploy role that GitHub Actions can assume to run `cdk deploy` against the
 * ChessStats stacks.
 *
 * Deploy once: `cd infra && npx cdk deploy GithubOidc`
 * Then add the role ARN as a GitHub repo variable named `AWS_DEPLOY_ROLE_ARN`.
 */
export class GithubOidcStack extends cdk.Stack {
  public readonly deployRoleArn: string;

  constructor(scope: Construct, id: string, props: GithubOidcStackProps) {
    super(scope, id, props);

    const allowedRefs = props.allowedRefs ?? [
      `repo:${props.githubRepo}:ref:refs/heads/main`,
    ];

    // GitHub's OIDC provider is a per-account, region-agnostic resource — we
    // import the existing one (already provisioned for this account) rather
    // than creating it twice. The ARN format is deterministic.
    const providerArn = `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`;

    const deployRole = new iam.Role(this, "GithubDeployRole", {
      roleName: "github-actions-chess-stats-deploy",
      assumedBy: new iam.FederatedPrincipal(
        providerArn,
        {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          },
          StringLike: {
            "token.actions.githubusercontent.com:sub": allowedRefs,
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      description:
        "Assumed by GitHub Actions to deploy the ChessStats CDK stacks via OIDC.",
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // CDK v2 uses bootstrap roles named `cdk-<qualifier>-deploy-role-*`,
    // `cdk-<qualifier>-file-publishing-role-*`, etc. The deploy role only needs
    // permission to assume those — CDK picks them up automatically.
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
      })
    );

    this.deployRoleArn = deployRole.roleArn;

    new cdk.CfnOutput(this, "DeployRoleArn", {
      value: deployRole.roleArn,
      description:
        "Set this as a GitHub repo variable named AWS_DEPLOY_ROLE_ARN.",
    });
  }
}
