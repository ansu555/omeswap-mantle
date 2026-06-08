"""DEX client — web3.py async wrapper for the 0G DEX (Trader Joe V2-compatible) router.

Token addresses and router addresses are intentionally placeholder values for the
0G Newton Testnet.  Replace with live values once the 0G DEX is deployed to mainnet
(update lib/chain-registry/chains/zerog.ts and set the env vars accordingly).
"""
from __future__ import annotations

import time
from web3 import AsyncWeb3, AsyncHTTPProvider
from web3.middleware import SignAndSendRawMiddlewareBuilder
from eth_account import Account
from ats.config import settings

# ── Minimal ABI — only the functions we call ──────────────────────────────────

TRADER_JOE_V2_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn",    "type": "uint256"},
            {"internalType": "uint256", "name": "amountOutMin","type": "uint256"},
            {"internalType": "address[]","name": "path",       "type": "address[]"},
            {"internalType": "address", "name": "to",          "type": "address"},
            {"internalType": "uint256", "name": "deadline",    "type": "uint256"},
        ],
        "name": "swapExactTokensForTokens",
        "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256",  "name": "amountIn", "type": "uint256"},
            {"internalType": "address[]","name": "path",     "type": "address[]"},
        ],
        "name": "getAmountsOut",
        "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
        "stateMutability": "view",
        "type": "function",
    },
]

ERC20_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "spender", "type": "address"},
            {"internalType": "uint256", "name": "amount",  "type": "uint256"},
        ],
        "name": "approve",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# ── Token addresses on 0G Chain Newton Testnet ────────────────────────────────
# TODO: replace with live addresses once the 0G DEX deploys to mainnet
TOKEN_ADDRESSES: dict[str, str] = {
    "W0G":  "0x0000000000000000000000000000000000000001",
    "USDC": "0x0000000000000000000000000000000000000002",
    "USDT": "0x0000000000000000000000000000000000000003",
    "WETH": "0x0000000000000000000000000000000000000004",
    "WBTC": "0x0000000000000000000000000000000000000005",
}

# ── Singleton web3 instance ───────────────────────────────────────────────────

_w3: AsyncWeb3 | None = None


def get_w3() -> AsyncWeb3:
    """Return (or lazily create) the singleton AsyncWeb3 instance.

    The SignAndSendRawMiddleware automatically signs all transact() calls with
    AGENT_WALLET_PRIVATE_KEY, so callers never handle raw keys.
    """
    global _w3
    if _w3 is None:
        account = Account.from_key(settings.agent_wallet_private_key)
        _w3 = AsyncWeb3(AsyncHTTPProvider(settings.rpc_url))
        _w3.middleware_onion.inject(
            SignAndSendRawMiddlewareBuilder.build(account), layer=0
        )
    return _w3


def get_agent_address() -> str:
    """Derive the public address from the configured private key."""
    return Account.from_key(settings.agent_wallet_private_key).address


# ── On-chain helpers ──────────────────────────────────────────────────────────

async def get_quote(token_in: str, token_out: str, amount_in_wei: int) -> int:
    """Call getAmountsOut — returns expected output in token_out's smallest unit."""
    w3 = get_w3()
    router = w3.eth.contract(
        address=w3.to_checksum_address(settings.dex_router_address),
        abi=TRADER_JOE_V2_ABI,
    )
    path = [
        w3.to_checksum_address(TOKEN_ADDRESSES[token_in]),
        w3.to_checksum_address(TOKEN_ADDRESSES[token_out]),
    ]
    amounts = await router.functions.getAmountsOut(amount_in_wei, path).call()
    return int(amounts[-1])


async def approve_token(token: str, amount_wei: int) -> str:
    """Approve the DEX router to spend `amount_wei` of `token`.

    Returns the tx hash hex string.
    """
    w3 = get_w3()
    token_contract = w3.eth.contract(
        address=w3.to_checksum_address(TOKEN_ADDRESSES[token]),
        abi=ERC20_ABI,
    )
    tx_hash = await token_contract.functions.approve(
        w3.to_checksum_address(settings.dex_router_address),
        amount_wei,
    ).transact({"from": get_agent_address()})
    return tx_hash.hex()


async def swap_exact_tokens(
    token_in: str,
    token_out: str,
    amount_in_wei: int,
    min_amount_out_wei: int,
    deadline_seconds: int = 300,
) -> str:
    """Submit swapExactTokensForTokens — returns tx hash hex string."""
    w3 = get_w3()
    router = w3.eth.contract(
        address=w3.to_checksum_address(settings.dex_router_address),
        abi=TRADER_JOE_V2_ABI,
    )
    path = [
        w3.to_checksum_address(TOKEN_ADDRESSES[token_in]),
        w3.to_checksum_address(TOKEN_ADDRESSES[token_out]),
    ]
    tx_hash = await router.functions.swapExactTokensForTokens(
        amount_in_wei,
        min_amount_out_wei,
        path,
        get_agent_address(),
        int(time.time()) + deadline_seconds,
    ).transact({"from": get_agent_address()})
    return tx_hash.hex()


async def get_token_balance(token: str, address: str | None = None) -> int:
    """Return token balance in smallest unit for `address` (default: agent wallet)."""
    w3 = get_w3()
    owner = address or get_agent_address()
    token_contract = w3.eth.contract(
        address=w3.to_checksum_address(TOKEN_ADDRESSES[token]),
        abi=ERC20_ABI,
    )
    return int(await token_contract.functions.balanceOf(owner).call())
