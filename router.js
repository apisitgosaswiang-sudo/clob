{
  "rules": {
    "clob": {
      ".read": "auth != null",
      ".write": "auth != null",
      "exercises": {
        ".read": true,
        ".write": "auth != null"
      },
      "exercisePreferences": {
        "$uid": {
          ".read": "$uid === auth.uid",
          ".write": "$uid === auth.uid"
        }
      },
      "progress": {
        "$memberCode": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      },
      "onlineCoaching": {
        "$memberCode": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      },
      "v1": {
        "memberExperience": {
          "$memberCode": {
            ".read": "auth != null",
            ".write": "auth != null"
          }
        }
      },
      "systemBackups": {
        ".read": "auth != null",
        ".write": "auth != null"
      },
      "system": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}