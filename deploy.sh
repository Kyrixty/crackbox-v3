echo "Via main"
git checkout main

echo "Switching to src/web"
cd src/web
echo "Building app.."
npm run build

echo "Deploying files to server.."
scp -r dist/* rt@172.105.27.148:/var/www/gaybaby/

echo "Finished frontend"