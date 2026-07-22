rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /members/{memberId}/{allPaths=**} {
      allow read: if request.auth != null;

      allow write: if request.auth != null
        && request.resource.size < 5 * 1024 * 1024
        && (
          request.resource.contentType == 'image/webp' ||
          request.resource.contentType == 'image/jpeg' ||
          request.resource.contentType == 'image/png'
        );
    }
  }
}
