/* eslint-disable import/no-extraneous-dependencies */
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
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import ReactFlow, {
  Background,
  SelectionMode,
  applyNodeChanges,
  useReactFlow,
} from 'reactflow';
import { debounce } from 'lodash';
import { styled, t } from '@superset-ui/core';
import { EmptyStateBig } from 'src/components/EmptyState';
import { componentShape } from '../util/propShapes';
import DashboardComponent from '../containers/DashboardComponent';
import DragDroppable from './dnd/DragDroppable';
import { TAB_TYPE } from '../util/componentTypes';

const propTypes = {
  id: PropTypes.string.isRequired,
  depth: PropTypes.number.isRequired,
  editMode: PropTypes.bool,
  gridComponent: componentShape,
  handleComponentDrop: PropTypes.func.isRequired,
  isComponentVisible: PropTypes.bool.isRequired,
  width: PropTypes.number.isRequired,
  dashboardId: PropTypes.number,
};

const nodeTypes = {
  DashboardComponent,
};

const defaultProps = {};

const DashboardEmptyStateContainer = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
`;

const StyledDiv = styled.div`
  flex-direction: column;
  display: flex;
  flex-grow: 1;
  height: 100%;
`;

const DashboardGrid = forwardRef((props, ref) => {
  const {
    id,
    gridComponent,
    handleComponentDrop,
    dashboardLayoutChange,
    deleteComponent,
    depth,
    width,
    editMode,
    canEdit,
    setEditMode,
    dashboardId,
  } = props;
  const [nodesState, setNodesState] = useState([]);
  const { project } = useReactFlow();

  useEffect(() => {
    setNodesState(gridComponent?.meta?.layout ?? []);
  }, [gridComponent?.meta?.layout]);

  const debouncedDashboardLayoutChange = useMemo(
    () => debounce(dashboardLayoutChange, 500),
    [dashboardLayoutChange],
  );

  const setNodes = useCallback(
    nodes => {
      setNodesState(nodes);
      debouncedDashboardLayoutChange(id, nodes);
    },
    [id],
  );

  const onNodesChange = useCallback(
    nodeChanges => {
      setNodesState(nodes => {
        const newNodes = applyNodeChanges(nodeChanges, nodes);
        debouncedDashboardLayoutChange(id, newNodes);
        return newNodes;
      });
    },
    [id],
  );

  const onNodesDelete = useCallback(
    nodes => {
      nodes.forEach(node => {
        deleteComponent(node.id, gridComponent?.id);
      });
    },
    [gridComponent?.id],
  );

  const handleTopDropTargetDrop = useCallback(dropResult => {
    if (dropResult) {
      const refBoundingRect =
        dropResult.Component.ref?.getBoundingClientRect() ?? {
          top: 0,
          left: 0,
        };
      const clientOffset = dropResult.monitor.getClientOffset() ?? {
        x: 0,
        y: 0,
      };

      handleComponentDrop({
        ...dropResult,
        destination: {
          ...dropResult.destination,
          // force appending as the first child if top drop target
          index: 0,
        },
        position: project({
          x: Math.abs(clientOffset.x - refBoundingRect.left),
          y: Math.abs(clientOffset.y - refBoundingRect.top),
        }),
      });
    }
  }, []);

  const renderReactFlow = () => (
    <ReactFlow
      minZoom={1}
      maxZoom={1}
      // fitView
      translateExtent={[
        [0, 0],
        [width, Number.POSITIVE_INFINITY],
      ]}
      nodeExtent={[
        [0, 0],
        [width, Number.POSITIVE_INFINITY],
      ]}
      nodeTypes={nodeTypes}
      nodes={nodesState}
      setNodes={setNodes}
      onNodesChange={onNodesChange}
      onNodesDelete={onNodesDelete}
      paneMoveable={false}
      panOnScroll
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      onlyRenderVisibleElements={false}
      preventScrolling={false}
      selectionMode={SelectionMode.Partial}
      nodesDraggable={editMode}
    >
      {editMode ? <Background /> : null}
    </ReactFlow>
  );

  const shouldDisplayEmptyState = gridComponent?.children?.length === 0;
  const shouldDisplayTopLevelTabEmptyState =
    shouldDisplayEmptyState && gridComponent.type === TAB_TYPE;

  const dashboardEmptyState = editMode && (
    <EmptyStateBig
      title={t('Drag and drop components and charts to the dashboard')}
      description={t(
        'You can create a new chart or use existing ones from the panel on the right',
      )}
      buttonText={
        <>
          <i className="fa fa-plus" />
          {t('Create a new chart')}
        </>
      }
      buttonAction={() => {
        window.open(
          `/chart/add?dashboard_id=${dashboardId}`,
          '_blank',
          'noopener noreferrer',
        );
      }}
      image="chart.svg"
    />
  );

  const topLevelTabEmptyState = editMode ? (
    <EmptyStateBig
      title={t('Drag and drop components to this tab')}
      description={t(
        `You can create a new chart or use existing ones from the panel on the right`,
      )}
      buttonText={
        <>
          <i className="fa fa-plus" />
          {t('Create a new chart')}
        </>
      }
      buttonAction={() => {
        window.open(
          `/chart/add?dashboard_id=${dashboardId}`,
          '_blank',
          'noopener noreferrer',
        );
      }}
      image="chart.svg"
    />
  ) : (
    <EmptyStateBig
      title={t('There are no components added to this tab')}
      description={canEdit && t('You can add the components in the edit mode.')}
      buttonText={canEdit && t('Edit the dashboard')}
      buttonAction={
        canEdit &&
        (() => {
          setEditMode(true);
        })
      }
      image="chart.svg"
    />
  );

  return width < 100 ? null : (
    <>
      {shouldDisplayEmptyState && (
        <DashboardEmptyStateContainer>
          {shouldDisplayTopLevelTabEmptyState
            ? topLevelTabEmptyState
            : dashboardEmptyState}
        </DashboardEmptyStateContainer>
      )}
      <StyledDiv className="dashboard-grid" ref={ref}>
        {editMode ? (
          <DragDroppable
            component={gridComponent}
            depth={depth}
            parentComponent={null}
            index={0}
            orientation="column"
            onDrop={handleTopDropTargetDrop}
            className="empty-droptarget"
            editMode
            style={{ height: '100%' }}
          >
            {renderReactFlow}
          </DragDroppable>
        ) : (
          renderReactFlow()
        )}
      </StyledDiv>
    </>
  );
});

DashboardGrid.propTypes = propTypes;
DashboardGrid.defaultProps = defaultProps;

export default DashboardGrid;
