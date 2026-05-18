import * as cdk from "aws-cdk-lib";
import { ChessStatsStack } from "../lib/chess-stack";
import { GithubOidcStack } from "../lib/github-oidc-stack";

const app = new cdk.App();

cdk.Tags.of(app).add("Project", "chess-games-history");

const envName = (app.node.tryGetContext("env") as string) ?? "dev";
if (envName !== "dev" && envName !== "prod") {
  throw new Error(`Context 'env' must be 'dev' or 'prod', got '${envName}'`);
}

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
};

new ChessStatsStack(app, `ChessStats-${envName}`, {
  envName,
  env,
});

// One-time / rarely-changed stack: GitHub OIDC provider + deploy role.
// Deploy with:  npx cdk deploy GithubOidc
new GithubOidcStack(app, "GithubOidc", {
  githubRepo: "AlphaAnimal/chess-games-history",
  env,
});
