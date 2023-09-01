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
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import {
  NodeResizeControl,
  useStore as useReactflowStore,
  useReactFlow,
  NodeToolbar,
  Position,
} from 'reactflow';
import { logEvent } from 'src/logger/actions';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { componentLayoutLookup, componentLookup } from 'src/dashboard/components/gridComponents';
import getDetailedComponentWidth from 'src/dashboard/util/getDetailedComponentWidth';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { componentShape } from 'src/dashboard/util/propShapes';
import {
  CHART_TYPE,
  COLUMN_TYPE,
  MARKDOWN_TYPE,
  ROW_TYPE,
} from 'src/dashboard/util/componentTypes';
import {
  createComponent,
  deleteComponent,
  updateComponents,
  handleComponentDrop,
} from 'src/dashboard/actions/dashboardLayout';
import {
  setDirectPathToChild,
  setActiveTabs,
  setFullSizeChartId,
} from 'src/dashboard/actions/dashboardState';
import DeleteComponentButton from '../components/DeleteComponentButton';

const propTypes = {
  id: PropTypes.string,
  parentId: PropTypes.string,
  depth: PropTypes.number,
  index: PropTypes.number,
  renderHoverMenu: PropTypes.bool,
  renderTabContent: PropTypes.bool,
  onChangeTab: PropTypes.func,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  createComponent: PropTypes.func.isRequired,
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
  logEvent: PropTypes.func.isRequired,
  directPathToChild: PropTypes.arrayOf(PropTypes.string),
  directPathLastUpdated: PropTypes.number,
  dashboardId: PropTypes.number.isRequired,
  isComponentVisible: PropTypes.bool,
};

const defaultProps = {
  isComponentVisible: true,
};

function mapStateToProps(
  { dashboardLayout: undoableLayout, dashboardState, dashboardInfo },
  ownProps,
) {
  const dashboardLayout = undoableLayout.present;
  const { id, parentId } = ownProps;
  const component = dashboardLayout[id];
  const props = {
    id,
    component,
    getComponentById: id => dashboardLayout[id],
    parentComponent: dashboardLayout[parentId],
    editMode: dashboardState.editMode,
    filters: getActiveFilters(),
    dashboardId: dashboardInfo.id,
    fullSizeChartId: dashboardState.fullSizeChartId,
  };

  // rows and columns need more data about their child dimensions
  // doing this allows us to not pass the entire component lookup to all Components
  if (component) {
    const componentType = component.type;
    if (componentType === ROW_TYPE || componentType === COLUMN_TYPE) {
      const { occupiedWidth, minimumWidth } = getDetailedComponentWidth({
        id,
        components: dashboardLayout,
      });

      if (componentType === ROW_TYPE) props.occupiedColumnCount = occupiedWidth;
      if (componentType === COLUMN_TYPE) props.minColumnWidth = minimumWidth;
    }
  }

  return props;
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      addDangerToast,
      createComponent,
      deleteComponent,
      updateComponents,
      handleComponentDrop,
      setDirectPathToChild,
      setFullSizeChartId,
      setActiveTabs,
      logEvent,
    },
    dispatch,
  );
}

const DashboardComponent = (props) => {
  const { id, component } = props;
  const componentState = useReactflowStore((state) => state.nodeInternals.get(id));
  const { deleteElements } = useReactFlow();

  const handleDeleteComponent = useCallback(() => {
    deleteElements({ nodes: [{ id }] });
  }, [deleteElements, id]);

  const Component = component ? componentLookup[component.type] : null;
  const layoutConfig = component ? componentLayoutLookup[component.type] : null;
  const element = Component
    ? (
      <Component
        size={component.type === CHART_TYPE || component.type === MARKDOWN_TYPE ? {
          width: componentState?.width,
          height: componentState?.height,
        } : undefined}
        {...props}
      />
    )
    : null;

  if (props.editMode) {
    return (
      <>
        {element}
        {layoutConfig ? layoutConfig.resizeControls.map((c) => (
          <NodeResizeControl
            key={c}
            position={c}
            minWidth={layoutConfig.minWidth}
            minHeight={layoutConfig.minHeight}
          />
        )) : null}
        {layoutConfig?.toolbar ? (
          <NodeToolbar position={Position.Left}>
            <DeleteComponentButton
              onDelete={handleDeleteComponent}
            />
          </NodeToolbar>
        ) : null}
      </>
    );
  }

  return element;
}

DashboardComponent.propTypes = propTypes;
DashboardComponent.defaultProps = defaultProps;

export default connect(mapStateToProps, mapDispatchToProps)(DashboardComponent);
