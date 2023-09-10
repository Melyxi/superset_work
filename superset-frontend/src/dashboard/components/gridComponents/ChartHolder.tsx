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
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ResizeCallback, ResizeStartCallback } from 're-resizable';
// eslint-disable-next-line import/no-extraneous-dependencies
import { useReactFlow } from 'reactflow';
import cx from 'classnames';
import { useSelector } from 'react-redux';
import { css } from '@superset-ui/core';
import { LayoutItem, RootState } from 'src/dashboard/types';
import AnchorLink from 'src/dashboard/components/AnchorLink';
import Chart from 'src/dashboard/containers/Chart';
import getChartAndLabelComponentIdFromPath from 'src/dashboard/util/getChartAndLabelComponentIdFromPath';
import useFilterFocusHighlightStyles from 'src/dashboard/util/useFilterFocusHighlightStyles';
import HoverMenu from '../menu/HoverMenu';
import DeleteComponentButton from '../DeleteComponentButton';

export const CHART_MARGIN = 32;

interface ChartHolderProps {
  id: string;
  parentId: string;
  dashboardId: number;
  component: LayoutItem;
  parentComponent: LayoutItem;
  getComponentById?: (id?: string) => LayoutItem | undefined;
  index: number;
  depth: number;
  editMode: boolean;
  directPathLastUpdated?: number;
  fullSizeChartId: number | null;
  isComponentVisible: boolean;
  size?: {
    width?: number;
    height?: number;
  };

  // grid related
  availableColumnCount: number;
  columnWidth: number;
  onResizeStart: ResizeStartCallback;
  onResize: ResizeCallback;
  onResizeStop: ResizeCallback;

  // dnd
  deleteComponent: (id: string, parentId: string) => void;
  updateComponents: Function;
  handleComponentDrop: (...args: unknown[]) => unknown;
  setFullSizeChartId: (chartId: number | null) => void;
  isInView: boolean;
}

const fullSizeStyle = css`
  && {
    position: fixed;
    z-index: 3000;
    left: 0;
    top: 0;
  }
`;

const ChartHolder: React.FC<ChartHolderProps> = ({
  id,
  component,
  editMode,
  isComponentVisible,
  dashboardId,
  fullSizeChartId,
  updateComponents,
  setFullSizeChartId,
  isInView,
  size,
}) => {
  const { chartId } = component.meta;
  const isFullSize = fullSizeChartId === chartId;

  const { deleteElements } = useReactFlow();

  const focusHighlightStyles = useFilterFocusHighlightStyles(chartId);
  const dashboardState = useSelector(
    (state: RootState) => state.dashboardState,
  );
  const [extraControls, setExtraControls] = useState<Record<string, unknown>>(
    {},
  );
  const [outlinedComponentId, setOutlinedComponentId] = useState<string>();
  const [outlinedColumnName, setOutlinedColumnName] = useState<string>();
  const [currentDirectPathLastUpdated, setCurrentDirectPathLastUpdated] =
    useState(0);

  const directPathToChild = useMemo(
    () => dashboardState?.directPathToChild ?? [],
    [dashboardState],
  );

  const directPathLastUpdated = useMemo(
    () => dashboardState?.directPathLastUpdated ?? 0,
    [dashboardState],
  );

  const infoFromPath = useMemo(
    () => getChartAndLabelComponentIdFromPath(directPathToChild) as any,
    [directPathToChild],
  );

  // Calculate if the chart should be outlined
  useEffect(() => {
    const { label: columnName, chart: chartComponentId } = infoFromPath;

    if (
      directPathLastUpdated !== currentDirectPathLastUpdated &&
      component.id === chartComponentId
    ) {
      setCurrentDirectPathLastUpdated(directPathLastUpdated);
      setOutlinedComponentId(component.id);
      setOutlinedColumnName(columnName);
    }
  }, [
    component,
    currentDirectPathLastUpdated,
    directPathLastUpdated,
    infoFromPath,
  ]);

  // Remove the chart outline after a defined time
  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (outlinedComponentId) {
      timerId = setTimeout(() => {
        setOutlinedComponentId(undefined);
        setOutlinedColumnName(undefined);
      }, 2000);
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [outlinedComponentId]);

  let chartWidth = 0;
  let chartHeight = 0;

  if (isFullSize) {
    chartWidth = window.innerWidth - CHART_MARGIN;
    chartHeight = window.innerHeight - CHART_MARGIN;
  } else {
    chartWidth = size?.width ?? 0;
    chartHeight = size?.height ?? 0;
  }

  const handleUpdateSliceName = useCallback(
    (nextName: string) => {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            sliceNameOverride: nextName,
          },
        },
      });
    },
    [component, updateComponents],
  );

  const handleToggleFullSize = useCallback(() => {
    setFullSizeChartId(isFullSize ? null : chartId);
  }, [chartId, isFullSize, setFullSizeChartId]);

  const handleExtraControl = useCallback((name: string, value: unknown) => {
    setExtraControls(current => ({
      ...current,
      [name]: value,
    }));
  }, []);

  const handleDeleteComponent = useCallback(() => {
    deleteElements({ nodes: [{ id }] });
  }, [deleteElements, id]);

  return (
    <div
      data-test="dashboard-component-chart-holder"
      style={focusHighlightStyles}
      css={isFullSize ? fullSizeStyle : undefined}
      className={cx(
        'dashboard-component',
        'dashboard-component-chart-holder',
        // The following class is added to support custom dashboard styling via the CSS editor
        `dashboard-chart-id-${chartId}`,
        outlinedComponentId ? 'fade-in' : 'fade-out',
      )}
    >
      {!editMode && (
        <AnchorLink
          id={component.id}
          scrollIntoView={outlinedComponentId === component.id}
        />
      )}
      {!!outlinedComponentId && (
        <style>
          {`label[for=${outlinedColumnName}] + .Select .Select__control {
              border-color: #00736a;
              transition: border-color 1s ease-in-out;
            }`}
        </style>
      )}
      <Chart
        componentId={component.id}
        id={component.meta.chartId}
        dashboardId={dashboardId}
        width={chartWidth}
        height={chartHeight}
        sliceName={
          component.meta.sliceNameOverride || component.meta.sliceName || ''
        }
        updateSliceName={handleUpdateSliceName}
        isComponentVisible={isComponentVisible}
        handleToggleFullSize={handleToggleFullSize}
        isFullSize={isFullSize}
        setControlValue={handleExtraControl}
        extraControls={extraControls}
        isInView={isInView}
      />
      {editMode && (
        <HoverMenu position="top">
          <div data-test="dashboard-delete-component-button">
            <DeleteComponentButton onDelete={handleDeleteComponent} />
          </div>
        </HoverMenu>
      )}
    </div>
  );
};

export default ChartHolder;
