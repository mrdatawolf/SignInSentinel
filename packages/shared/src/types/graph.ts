export interface GraphSignIn {
  id: string;
  createdDateTime: string;
  userDisplayName: string;
  userPrincipalName: string;
  userId: string;
  appId: string;
  appDisplayName: string;
  ipAddress: string;
  clientAppUsed: string;
  correlationId: string;
  conditionalAccessStatus: "success" | "failure" | "notApplied";
  isInteractive: boolean;
  riskDetail: string;
  riskLevelAggregated: string;
  riskLevelDuringSignIn: string;
  riskState: string;
  riskEventTypes: string[];
  resourceDisplayName: string;
  resourceId: string;
  status: {
    errorCode: number;
    failureReason: string | null;
    additionalDetails: string | null;
  };
  deviceDetail: {
    deviceId: string;
    displayName: string | null;
    operatingSystem: string;
    browser: string;
    isCompliant: boolean | null;
    isManaged: boolean | null;
    trustType: string | null;
  };
  location: {
    city: string;
    state: string;
    countryOrRegion: string;
    geoCoordinates: {
      altitude: number | null;
      latitude: number;
      longitude: number;
    };
  };
  appliedConditionalAccessPolicies: Array<{
    id: string;
    displayName: string;
    enforcedGrantControls: string[];
    enforcedSessionControls: string[];
    result: string;
  }>;
}

export interface GraphSignInsResponse {
  "@odata.context": string;
  "@odata.nextLink"?: string;
  value: GraphSignIn[];
}
