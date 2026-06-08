FROM node:20-slim

# The 'node' user already exists with UID 1000 in this image
RUN apt-get update && apt-get install -y \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-fonts-recommended \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Change ownership of the app directory to the node user
RUN chown -R node:node /app

USER node

EXPOSE 7860

CMD ["npm", "start"]
