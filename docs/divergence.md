Functional Divergences from S3
===================

* We do not list ETag from bucket listings because we don't have the value of
  the md5 of the object available from Manta on directory listings.

* StorageClass maps to durability based on settings in the config file.

* Object ACLs are hard-coded to FULL_CONTROL.
 
* Multi-part upload list is always empty. 

* The MaxKeys response value is dynamically changed based on the total
  number of results returned if it isn't explicitly sent as part of the
  request. 
