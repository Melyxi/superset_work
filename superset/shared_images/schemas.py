# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

openapi_spec_methods_override = {
    "get": {"get": {"description": "Get a shared images"}},
    "get_list": {
        "get": {
            "description": "Get a list of shared images, use Rison or JSON "
            "query parameters for filtering, sorting,"
            " pagination and for selecting specific"
            " columns and metadata.",
        }
    },
    "post": {"post": {"description": "Create a shared images"}},
    "put": {"put": {"description": "Update a shared images"}},
    "delete": {"delete": {"description": "Delete shared images"}},
}

get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}
