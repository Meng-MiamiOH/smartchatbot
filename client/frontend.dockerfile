FROM node:18.16-alpine
WORKDIR /app
RUN rm -rf node_modules/.vite/
RUN rm -rf dist/
RUN npm cache clean --force
COPY package*.json ./

# Install dependencies
RUN npm install
RUN npm install react-markdown remark-gfm
COPY . .

# Build the app
RUN npm run build

# Expose the port the app runs on
EXPOSE 5173

# Start the app
CMD ["npm", "run", "serve"]
