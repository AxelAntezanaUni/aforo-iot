FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY conteo/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY comun/ comun/
COPY conteo/logica.py conteo/main.py ./
CMD ["python", "main.py"]
