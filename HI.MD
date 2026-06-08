Replace ansu555, omeswap-templet, and omeswap-templet with your GitHub org/omeswap-templet and a pinned SHA ( permalink).

Strong anchors:

MCP call into AXL — callMcpService / topology:
https://github.com/ansu555/omeswap-templet/blob/omeswap-templet/lib/axl/client.ts#L69-L80

Remote agents + payload.axl tagging — replayEvents:
https://github.com/ansu555/omeswap-templet/blob/omeswap-templet/lib/ats/remote-agents.ts#L36-L55

Orchestrator chooses local vs AXL — activeTransport and remote function selection:
https://github.com/ansu555/omeswap-templet/blob/omeswap-templet/lib/ats/orchestrator.ts#L197-L260

If they only want one link, use lib/ats/remote-agents.ts around the payload.axl block—that is the clearest “product + protocol” proof.

