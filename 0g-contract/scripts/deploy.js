const hre = require("hardhat");
const { ethers } = hre;

// 0G mainnet token addresses
const W0G_ADDRESS   = "0x1cd0690ff9a693f5ef2dd976660a8dafc81a109c";
const USDC_ADDRESS  = "0x1f3aa82227281ca364bfb3d253b0f1af1da6473e";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "0G");

  // 1. Deploy Pools
  console.log("\n[1/4] Deploying MultiTokenLiquidityPools...");
  const Pools = await ethers.getContractFactory("MultiTokenLiquidityPools");
  const pools = await Pools.deploy();
  await pools.waitForDeployment();
  const poolsAddress = await pools.getAddress();
  console.log("MultiTokenLiquidityPools:", poolsAddress);

  // 2. Deploy Router
  console.log("\n[2/4] Deploying MultiHopSwapRouter...");
  const Router = await ethers.getContractFactory("MultiHopSwapRouter");
  const router = await Router.deploy(poolsAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("MultiHopSwapRouter:", routerAddress);

  // 3. Create the W0G/USDC.e pool
  console.log("\n[3/4] Creating W0G/USDC.e pool...");
  const createTx = await pools.createPool(W0G_ADDRESS, USDC_ADDRESS);
  await createTx.wait();
  const poolId = await pools.getPoolId(W0G_ADDRESS, USDC_ADDRESS);
  console.log("Pool created, ID:", poolId.toString());

  // 4. Done — print summary
  console.log("\n[4/4] Deployment complete!");
  console.log("=".repeat(60));
  console.log("COPY THESE INTO lib/chain-registry/chains/zerog.ts:");
  console.log("=".repeat(60));
  console.log(`  omeswapPools:  "${poolsAddress}"`);
  console.log(`  omeswapRouter: "${routerAddress}"`);
  console.log("=".repeat(60));
  console.log("\nNext step: add liquidity using scripts/addLiquidity.js");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
