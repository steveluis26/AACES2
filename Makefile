SHELL := /bin/bash

FRONTEND_DIR := frontend
BACKEND_DIR := backend
PID_DIR := .pids
FRONTEND_PID := $(PID_DIR)/frontend.pid
BACKEND_PID := $(PID_DIR)/backend.pid

FRONTEND_PORT := 3000
BACKEND_PORT := 8000
NEXT_PUBLIC_API_URL := http://127.0.0.1:$(BACKEND_PORT)

DOCKER := docker
COMPOSE := $(DOCKER) compose

.PHONY: help dev frontend backend stop status up down ps logs build restart lint typecheck test clean

help:
	@echo "Targets:"
	@echo "  dev            Start backend and frontend locally"
	@echo "  frontend       Start Next.js dev server"
	@echo "  backend        Start FastAPI dev server"
	@echo "  stop           Stop local dev servers"
	@echo "  status         Show local dev server status"
	@echo "  up             Start docker services"
	@echo "  down           Stop docker services"
	@echo "  ps             List docker services"
	@echo "  logs           Tail docker logs"
	@echo "  build          Build docker images"
	@echo "  restart        Restart docker services"
	@echo "  lint           Run frontend linters"
	@echo "  typecheck      Run frontend type-check"
	@echo "  test           Run frontend tests"
	@echo "  clean          Remove PID and logs"

dev: frontend backend

frontend:
	mkdir -p $(PID_DIR)
	(cd $(FRONTEND_DIR) && NEXT_PUBLIC_API_URL=$(NEXT_PUBLIC_API_URL) npm run dev -- -p $(FRONTEND_PORT)) > frontend.dev.log 2>&1 & echo $$! > $(FRONTEND_PID)

backend:
	mkdir -p $(PID_DIR)
	(cd $(BACKEND_DIR) && python3 -m uvicorn main:app --host 127.0.0.1 --port $(BACKEND_PORT) --reload) > backend.dev.log 2>&1 & echo $$! > $(BACKEND_PID)

stop:
	if [ -f $(FRONTEND_PID) ]; then kill -TERM $$(cat $(FRONTEND_PID)) || true; rm -f $(FRONTEND_PID); fi
	if [ -f $(BACKEND_PID) ]; then kill -TERM $$(cat $(BACKEND_PID)) || true; rm -f $(BACKEND_PID); fi

status:
	@if [ -f $(FRONTEND_PID) ]; then echo "frontend: $$(cat $(FRONTEND_PID))"; ps -p $$(cat $(FRONTEND_PID)) -o pid,comm= || true; else echo "frontend: stopped"; fi
	@if [ -f $(BACKEND_PID) ]; then echo "backend: $$(cat $(BACKEND_PID))"; ps -p $$(cat $(BACKEND_PID)) -o pid,comm= || true; else echo "backend: stopped"; fi

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f

build:
	$(COMPOSE) build

restart:
	$(COMPOSE) restart

lint:
	(cd $(FRONTEND_DIR) && npm run lint && npm run lint:css)

typecheck:
	(cd $(FRONTEND_DIR) && npm run type-check)

test:
	(cd $(FRONTEND_DIR) && npm test)

clean:
	rm -f $(FRONTEND_PID) $(BACKEND_PID) frontend.dev.log backend.dev.log
