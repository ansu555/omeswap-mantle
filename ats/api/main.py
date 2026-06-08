from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from ats.api.ws_manager import ws_manager
from ats.api.routes import activations, receipts, chat
from ats.data.postgres_client import create_tables
from ats.agents.agent6_execution import Agent6Execution

app = FastAPI(title="ATS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(activations.router)
app.include_router(receipts.router)
app.include_router(chat.router)

_agent6 = Agent6Execution()


@app.on_event("startup")
async def startup():
    await create_tables()
    await _agent6.start()  # launches stop-loss monitor background task


@app.get("/health")
async def health():
    return {"status": "ok", "ws_connections": ws_manager.connection_count}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep connection alive; server pushes events
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
