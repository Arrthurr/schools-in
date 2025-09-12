#!/bin/bash

# Script to prepare Next.js app for Firebase Functions deployment

echo "📦 Preparing Next.js app for Firebase Functions..."

# Build the Next.js app
echo "🔨 Building Next.js app..."
npm run build

# Copy .next directory to functions
echo "📁 Copying .next to functions directory..."
rm -rf functions/.next
cp -r .next functions/

# Copy public directory to functions
echo "📁 Copying public to functions directory..."
rm -rf functions/public
cp -r public functions/

# Copy package.json files and other necessary files
echo "📄 Copying configuration files..."
cp package.json functions/package-app.json
cp next.config.js functions/
cp -r src functions/

# Install dependencies in functions directory
echo "📦 Installing dependencies in functions directory..."
cd functions
npm install

echo "✅ Functions preparation complete!"