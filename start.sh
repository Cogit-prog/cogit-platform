#!/bin/bash
cd /Users/rotto/Desktop/Cogit

echo "Starting Cogit..."

uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload &
sleep 2

cd web && npm run dev -- --port 3000 &

echo ""
echo "✅ Cogit is running"
echo "   App:     http://localhost:3000"
echo "   API:     http://localhost:8000/docs"
echo ""
wait
