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
import componentIsResizable from './componentIsResizable';
import shouldWrapChildInRow from './shouldWrapChildInRow';
import newComponentFactory from './newComponentFactory';
import getComponentWidthFromDrop from './getComponentWidthFromDrop';

import { ROW_TYPE, TABS_TYPE, TAB_TYPE } from './componentTypes';
import { componentLayoutLookup } from '../components/gridComponents';

export default function newEntitiesFromDrop({ dropResult, layout }) {
  const { dragging, destination, position } = dropResult;

  const dragType = dragging.type;
  const dropEntity = layout[destination.id];
  const dropType = dropEntity.type;
  let newDropChild = newComponentFactory(dragType, dragging.meta);
  newDropChild.parents = (dropEntity.parents || []).concat(dropEntity.id);

  const newEntities = {
    [newDropChild.id]: newDropChild,
  };

  if (dragType === TABS_TYPE) {
    // create a new tab component
    const tabChild = newComponentFactory(TAB_TYPE);
    tabChild.parents = (dropEntity.parents || []).concat(dropEntity.id);
    newDropChild.children = [tabChild.id];
    newEntities[tabChild.id] = tabChild;
  }

  const nextDropChildren = [...dropEntity.children];
  nextDropChildren.splice(destination.index, 0, newDropChild.id);

  const layoutConfig = componentLayoutLookup[dragType];

  newEntities[destination.id] = {
    ...dropEntity,
    meta: {
      ...(dropEntity.meta ?? {}),
      layout: [
        ...(dropEntity.meta?.layout ?? []),
        {
          id: newDropChild.id,
          type: 'DashboardComponent',
          position: {
            x: position?.x ?? 0,
            y: position?.y ?? 0,
          },
          data: { ...newDropChild },
          style: {
            width: layoutConfig?.width ?? 200,
            height: layoutConfig?.height ?? 200,
          },
        },
      ],
    },
    children: nextDropChildren,
  };

  return newEntities;
}
