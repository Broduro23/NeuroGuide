CONTENT_LIBRARY = []

NEXT_CONTENT_ID = 1


def add_content(item):
    """
    Add an assessed learning resource to the temporary library.
    """
    global NEXT_CONTENT_ID

    item["id"] = NEXT_CONTENT_ID
    NEXT_CONTENT_ID += 1

    CONTENT_LIBRARY.append(item)

    return item

def get_content_by_id(content_id):
    """
    Retrieve a content item from the temporary library by its ID.
    """
    for item in CONTENT_LIBRARY:
        if item["id"] == content_id:
            return item
    return None

def get_all_content():
    """
    Retrieve all content items from the temporary library.
    """
    return CONTENT_LIBRARY
