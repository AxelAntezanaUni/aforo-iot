FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY sync/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY comun/ comun/
COPY sync/cola.py sync/lote.py sync/main.py ./
CMD ["python", "main.py"]
