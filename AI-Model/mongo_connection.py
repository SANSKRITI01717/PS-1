from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from typing import Dict, Any, Optional

# ======================================================================
# 🟢 Configuration Constants (SET THESE UP)
# ======================================================================

# Replace this with the URI provided by your MongoDB Atlas dashboard
ATLAS_URI = "mongodb+srv://your_username:your_password@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority" 
DATABASE_NAME = 'myDatabase'
COLLECTION_NAME = 'users'

# ======================================================================
# 🟢 The Core Reusable Function
# ======================================================================

def insert_document(data: Dict[str, Any]) -> Optional[Any]:
    """
    Connects to MongoDB Atlas, inserts a single document (dictionary), 
    and returns the result object containing the inserted ID.

    Args:
        data (dict): The dictionary containing the data to be inserted. 
                     Keys are field names, values are the data.

    Returns:
        Optional[Any]: The result object from insert_one, or None if insertion fails.
    """
    client = None # Initialize client outside the try block
    
    try:
        # 1. Connect to the MongoDB server
        print("🔗 Connecting to MongoDB Atlas...")
        client = MongoClient(ATLAS_URI)
        
        # Test the connection (ping the server)
        client.admin.command('ping')
        
        # 2. Access the specific database and collection
        db = client[DATABASE_NAME]
        collection = db[COLLECTION_NAME]
        
        # 3. Insert the document
        print(f"➡️ Inserting document into '{COLLECTION_NAME}'...")
        insert_result = collection.insert_one(data)
        
        return insert_result

    except ConnectionFailure as e:
        print(f"❌ ERROR: Failed to connect to MongoDB Atlas. Check your URI and network.")
        print(f"   Details: {e}")
        return None
    
    except OperationFailure as e:
        print(f"❌ ERROR: An operation failed (authentication, permissions, etc.).")
        print(f"   Details: {e}")
        return None
        
    except Exception as e:
        print(f"❌ ERROR: An unexpected error occurred during insertion.")
        print(f"   Details: {e}")
        return None
        
    finally:
        # 4. Ensure the connection is always closed
        if client:
            client.close()
            print("✅ Connection closed successfully.")
