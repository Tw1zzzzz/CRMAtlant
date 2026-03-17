FROM node:20-alpine as build

WORKDIR /app

# Copy root package.json and install frontend dependencies
COPY package*.json ./
COPY scripts ./scripts
RUN npm install --no-fund --no-audit

# Copy server package.json and install server dependencies
COPY src/server/package*.json ./src/server/
RUN cd src/server && npm install --no-fund --no-audit

# Copy all source code
COPY . .

# Build frontend
RUN npm run build

# Build server
RUN cd src/server && npm run build

FROM node:20-alpine as production

WORKDIR /app

# Copy built frontend
COPY --from=build /app/dist ./dist

# Copy built server
COPY --from=build /app/src/server/dist ./dist/server

# Copy server package.json
COPY --from=build /app/src/server/package*.json ./

# Install only production dependencies for server
RUN npm install --omit=dev --no-fund --no-audit

# Create uploads directory
RUN mkdir -p /app/uploads

# Set permissions
RUN chmod -R 755 /app

ENV PORT=5000
ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "dist/server/index.js"]
