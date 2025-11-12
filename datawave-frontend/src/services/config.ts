// DataWave Configuration Service

export class ConfigService {
  // Contract addresses (will be updated after deployment)
  private static readonly PACKAGE_ID = "0x7112ee34538a8280569cc20ad3c20de8f524e31f1cb2f95d3a0c5ccc01f691fa"; // Your deployed package ID
  private static readonly SURVEY_REGISTRY_ID = "0x6e823cfeabfaeab1d9bdc673f75e29ba4767a70040aecde96038169266a370bc"; // To be set after deployment
  private static readonly PLATFORM_TREASURY_ID = "0x76d4047bf1ab58015a94dd1acf272ca6b6913aa855cf87c52c5667e70bb00477"; // To be set after deployment
  private static readonly ADMIN_CAP_ID = "0xbb1a0cedcfbda94d4927d0438afc9fb41633f8131f3d9b78f5d79ce85c15f947"; // To be set after deployment
  
  // Network configuration
  private static readonly NETWORK = "testnet";
  private static readonly SUI_VIEW_TX_URL = "https://suiscan.xyz/testnet/tx";
  private static readonly SUI_VIEW_OBJECT_URL = "https://suiscan.xyz/testnet/object";
  
  // Seal encryption servers (from existing config)
  private static readonly SEAL_SERVER_OBJECT_IDS = [
    "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"
  ];
  
  // Walrus services configuration
  private static readonly WALRUS_SERVICES: Array<{
    id: string;
    name: string;
    publisherUrl: string;
    aggregatorUrl: string;
  }> = [
    {
      id: 'service1',
      name: 'walrus.space',
      publisherUrl: '/publisher1',
      aggregatorUrl: '/aggregator1',
    },
    {
      id: 'service2',
      name: 'staketab.org',
      publisherUrl: '/publisher2',
      aggregatorUrl: '/aggregator2',
    },
    {
      id: 'service3',
      name: 'redundex.com',
      publisherUrl: '/publisher3',
      aggregatorUrl: '/aggregator3',
    },
    {
      id: 'service4',
      name: 'nodes.guru',
      publisherUrl: '/publisher4',
      aggregatorUrl: '/aggregator4',
    },
    {
      id: 'service5',
      name: 'banansen.dev',
      publisherUrl: '/publisher5',
      aggregatorUrl: '/aggregator5',
    },
    {
      id: 'service6',
      name: 'everstake.one',
      publisherUrl: '/publisher6',
      aggregatorUrl: '/aggregator6',
    },
  ];
  
  // Platform configuration
  private static readonly NUM_EPOCH = 1; // Walrus storage epochs
  private static readonly PLATFORM_FEE_RATE = 250; // 2.5% in basis points
  private static readonly CREATOR_SHARE_RATE = 3000; // 30% in basis points
  
  // Getters
  static getPackageId(): string {
    return this.PACKAGE_ID;
  }
  
  static getSurveyRegistryId(): string {
    return this.SURVEY_REGISTRY_ID;
  }
  
  static getPlatformTreasuryId(): string {
    return this.PLATFORM_TREASURY_ID;
  }
  
  static getAdminCapId(): string {
    return this.ADMIN_CAP_ID;
  }
  
  static getSealServerObjectIds(): string[] {
    return this.SEAL_SERVER_OBJECT_IDS;
  }
  
  static getWalrusServices() {
    return this.WALRUS_SERVICES;
  }
  
  static getNetwork(): string {
    return this.NETWORK;
  }
  
  static getSuiExplorerUrl(type: 'tx' | 'object', id: string): string {
    return type === 'tx' 
      ? `${this.SUI_VIEW_TX_URL}/${id}`
      : `${this.SUI_VIEW_OBJECT_URL}/${id}`;
  }
  
  static getNumEpoch(): number {
    return this.NUM_EPOCH;
  }
  
  static getPlatformFeeRate(): number {
    return this.PLATFORM_FEE_RATE;
  }
  
  static getCreatorShareRate(): number {
    return this.CREATOR_SHARE_RATE;
  }
  
  // Set deployed contract IDs (call after deployment)
  static setDeployedContracts(
    registryId: string, 
    treasuryId: string, 
    adminCapId?: string
  ): void {
    // This would typically update environment variables or a config file
    console.log("Update the following IDs in ConfigService:");
    console.log("SURVEY_REGISTRY_ID:", registryId);
    console.log("PLATFORM_TREASURY_ID:", treasuryId);
    if (adminCapId) {
      console.log("ADMIN_CAP_ID:", adminCapId);
    }
  }
}