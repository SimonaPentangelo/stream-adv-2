
 const msalConfig = {
    auth: {
        clientId: "aeae26ff-cb77-437d-8eb4-3c52142d3621",
        authority: "https://login.microsoftonline.com/common",
        //authority: "https://token.botframework.com/.auth/web/redirect",
        clientSecret: "wf3j25Ov~2-88jllgghP67.jGaP.35h8.K"
    },
    cache: {
      cacheLocation: "sessionStorage", // This configures where your cache will be stored
      storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
    }
  };  
    
  // Add here the scopes to request when obtaining an access token for MS Graph API
  // for more, visit https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-core/docs/scopes.md
  const loginRequest = {
    scopes: ["openid", "profile", "User.Read"]
  };
  
  // Add here scopes for access token to be used at MS Graph API endpoints.
  const tokenRequest = {
    scopes: ["Mail.Read"]
  };