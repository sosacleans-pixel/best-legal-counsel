/* Best Legal Net agent notice config.
   KEEP THIS DISABLED until Salim approves a switch-on step.
   Do not put agent email addresses in this file or anywhere else in the public site. */
window.BLN_AGENT_NOTICE = {
  enabled: false,
  /* Deployed HTTPS URL of the tiny relay. Notices still do not send while enabled is false. */
  relayUrl: "https://bln-agent-notice.salimheyaime.workers.dev",
  /* Optional FormSubmit random-string aliases, keyed by agent id.
     An alias exists only after that agent inbox activates FormSubmit, which would
     email the agent. Do not add aliases, and do not put email addresses here. */
  formsubmitAliases: {},
  /* Query values that map to a numeric agent id. No contact details. */
  agentIds: {
    "1": "1",
    "hayser-scarlett": "1",
    "2": "2",
    "luis-barrera": "2"
  }
};
