FROM node:22-bullseye

# Instalar dependencias necesarias para node-canvas
RUN apt-get update && apt-get install -y \
    python3 \
    pkg-config \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Instalar dependencias (canvas compila aquí)
RUN npm install 

COPY . .

# Compilar NestJS
RUN npm run build

CMD ["npm", "run", "start:prod"]
