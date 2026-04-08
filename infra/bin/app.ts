import * as cdk from "aws-cdk-lib";
import { ChessStatsStack } from "../lib/chess-stack";

const app = new cdk.App();

const envName = (app.node.tryGetContext("env") as string) ?? "dev";
if (envName !== "dev" && envName !== "prod") {
  throw new Error(`Context 'env' must be 'dev' or 'prod', got '${envName}'`);
}

new ChessStatsStack(app, `ChessStats-${envName}`, {
  envName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
});
