# GCS Client Initialization
import json
from google.cloud import storage
from google.oauth2 import service_account
from .config import CREDENTIALS_JSON


def get_gcs_client():
    """Initializes the GCS Client from environment variable string or file"""
    if CREDENTIALS_JSON:
        # Load credentials from the JSON string stored in secrets
        cred_info = json.loads(CREDENTIALS_JSON)
        creds = service_account.Credentials.from_service_account_info(
            cred_info)
        return storage.Client(credentials=creds)
    else:
        # Fallback to standard environment variable lookups (local dev)
        return storage.Client()


# Global objects (initialized in lifespan)
gcs_client = None
bucket = None
