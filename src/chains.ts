import { defineChain } from 'viem';

export const mantle = defineChain({
  id: 5000,
  name: 'Mantle',
  nativeCurrency: {
    decimals: 18,
    name: 'Mantle',
    symbol: 'MNT',
  },
  rpcUrls: {
    default: { http: ['https://rpc.mantle.xyz'] },
  },
  blockExplorers: {
    default: { name: 'MantleScan', url: 'https://mantlescan.xyz' },
  },
});

export const mantleSepolia = defineChain({
  id: 5003,
  name: 'Mantle Sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Mantle',
    symbol: 'MNT',
  },
  rpcUrls: {
    default: { http: ['https://rpc.sepolia.mantle.xyz'] },
  },
  blockExplorers: {
    default: { name: 'MantleScan Sepolia', url: 'https://explorer.sepolia.mantle.xyz' },
  },
});

export const CONTRACT_ADDRESSES = {
  // Mainnet
  5000: {
    mETH: '0xcDA86A272531e8640cD7F1a92c01839911B90bb0',
    USDY: '0x5bE26527e817998A7206475496fDE1E68957c5A6',
    USDC: '0x09Bc77796E694E4E6d0690aCC5dB5cfc30Ca27b5',
    USDT: '0x201EBa5d93698b3b6478951152Cc577265eEaC00',
    multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11',
    moeRouter: '0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a',
    moeFactory: '0xa6630671775c4EA2743840F9A5016dCf2A104054',
    agniRouter: '0xDD49e8979e2617f694F90d0b00a35e9545465C58',
    aavePool: '0xCF111DF3dC764125f46BFC6471eE2e7c4f1cE5C8',
    identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e', // ERC-8004 registry
    agniPositionManager: '0x43867623910c5d258172eee0258fec0f84f4b88e0',
  },
  // Sepolia Testnet
  5003: {
    mETH: '0xcDA86A272531e8640cD7F1a92c01839911B90bb0',
    USDY: '0x5bE26527e817998A7206475496fDE1E68957c5A6',
    USDC: '0x8085B079738A2F250Bf05C5E644781CDD317D4a0',
    USDT: '0x8085B079738A2F250Bf05C5E644781CDD317D4a0',
    multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11',
    moeRouter: '0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a',
    moeFactory: '0xa6630671775c4EA2743840F9A5016dCf2A104054',
    agniRouter: '0xDD49e8979e2617f694F90d0b00a35e9545465C58',
    aavePool: '0xCF111DF3dC764125f46BFC6471eE2e7c4f1cE5C8',
    identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    agniPositionManager: '0x43867623910c5d258172eee0258fec0f84f4b88e0',
  },
} as const;

export function getAddresses(chainId: number) {
  return CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES] || CONTRACT_ADDRESSES[5000];
}
