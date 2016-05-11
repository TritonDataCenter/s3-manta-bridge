Divergences from S3
===================

* We do not list ETag from bucket listings because we don't have the value of
  the md5 of the object available from Manta on directory listings.

* Listing the contents of a bucket will stream the entire contents without
  paging because the Manta client ftw() method doesn't support paging.

* StorageClass maps to durability based on settings in the config file.
