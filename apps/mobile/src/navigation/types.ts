export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type TabsParamList = {
  Home: undefined;
  Stores: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  Tabs: undefined;
  StoreDetail: { storeId: string };
  VerifyPhone: undefined;
};
