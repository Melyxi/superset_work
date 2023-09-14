/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
// @ts-ignore
import React from 'react';
// @ts-ignore
import { t } from '@superset-ui/core';
import {
  ControlSetItem,
  ControlSetRow,
} from '../../packages/superset-ui-chart-controls/src';

const HideHeader: ControlSetItem = {
  name: 'hide_header',
  config: {
    type: 'CheckboxControl',
    label: t("Hide widget's header"),
    renderTrigger: true,
    default: false,
    description: t("Show or not widget's header"),
  },
};

export const hiddenHeader: ControlSetRow[] = [[HideHeader]];
