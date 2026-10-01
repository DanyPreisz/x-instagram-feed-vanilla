# X / Instagram feed · Vanilla JS + MongoDB Atlas

Posts, likes y comentarios. Colección `feed.posts`.

```bash
export GCP_PROJECT_ID=project-778283d9-dc7e-4c2c-947
export MONGODB_URI="mongodb+srv://dani:dany2233@cluster0.rqkadaa.mongodb.net/feed?retryWrites=true&w=majority&authSource=admin&appName=Cluster0"

gcloud run deploy x-instagram-feed-vanilla \
  --project $GCP_PROJECT_ID \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --update-env-vars="MONGODB_URI=${MONGODB_URI},MONGODB_DB=feed,MONGODB_COLLECTION=posts"
```
