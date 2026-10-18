# uso bookworm aunque la raspberry tenga trixie: trixie rechaza la clave del repo de raspberry pi (firma sha1)
FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && curl -fsSL https://archive.raspberrypi.com/debian/raspberrypi.gpg.key | gpg --dearmor -o /usr/share/keyrings/raspberrypi.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/raspberrypi.gpg] http://archive.raspberrypi.com/debian bookworm main" > /etc/apt/sources.list.d/raspi.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-gpiozero python3-lgpio python3-paho-mqtt \
 && apt-get purge -y curl gnupg && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
ENV PYTHONUNBUFFERED=1 GPIOZERO_PIN_FACTORY=lgpio
WORKDIR /app
COPY comun/ comun/
COPY adq_ir/main.py .
CMD ["python3", "main.py"]
