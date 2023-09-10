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
/* eslint-env browser */
import React, { useRef, useState } from 'react';
import { rgba } from 'emotion-rgba';
import Draggable from 'react-draggable';
import Tabs from 'src/components/Tabs';
import { t, css, SupersetTheme, styled } from '@superset-ui/core';
import SliceAdder from 'src/dashboard/containers/SliceAdder';
import dashboardComponents from 'src/visualizations/presets/dashboardComponents';
import NewDivider from '../gridComponents/new/NewDivider';
import NewHeader from '../gridComponents/new/NewHeader';
import NewTabs from '../gridComponents/new/NewTabs';
import NewMarkdown from '../gridComponents/new/NewMarkdown';
import NewDynamicComponent from '../gridComponents/new/NewDynamicComponent';

const BUILDER_PANE_WIDTH = 374;

const BuilderComponentPaneHeader = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: 12px;
  align-items: center;
  padding: 8px 12px;
  background-color: ${({ theme }) => theme.colors.grayscale.light4};

  & .dashboard-builder-title {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 12px;
    align-items: center;
    cursor: move;
  }
`;

const ExpandButton = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

const BuilderComponentPane = () => {
  const draggableRef = useRef<HTMLDivElement>(null);
  const [dragDisabled, setDragDisabled] = useState<boolean>(true);
  const [isOpen, setIsOpen] = useState<boolean>(true);

  const header = (
    <BuilderComponentPaneHeader className="dashboard-builder-header">
      <div
        className="dashboard-builder-title"
        onMouseOver={() => dragDisabled && setDragDisabled(false)}
        onMouseOut={() => !dragDisabled && setDragDisabled(true)}
      >
        <span>&nbsp;</span>
      </div>
      <ExpandButton role="button" onClick={() => setIsOpen(prev => !prev)}>
        <i className={`fa fa-chevron-${isOpen ? 'up' : 'down'}`} />
      </ExpandButton>
    </BuilderComponentPaneHeader>
  );

  return (
    <Draggable axis="both" bounds="parent" handle=".dashboard-builder-title">
      <div
        ref={draggableRef}
        data-test="dashboard-builder-sidepane"
        css={(theme: SupersetTheme) => css`
          position: absolute;
          right: 0;
          top: 0;
          width: ${BUILDER_PANE_WIDTH}px;
          box-shadow: 0 0 8px 0 ${rgba(theme.colors.grayscale.dark2, 0.1)};
          background-color: ${theme.colors.grayscale.light5};
        `}
      >
        {header}
        <Tabs
          data-test="dashboard-builder-component-pane-tabs-navigation"
          id="tabs"
          css={(theme: SupersetTheme) => css`
            display: ${isOpen ? undefined : 'none'};
            line-height: inherit;
            margin-top: ${theme.gridUnit * 2}px;
            height: 800px; // TODO: сделать вычисляемое значение

            & .ant-tabs-content-holder {
              height: 100%;
              & .ant-tabs-content {
                height: 100%;
              }
            }
          `}
        >
          <Tabs.TabPane
            key={1}
            tab={t('Charts')}
            css={css`
              height: 100%;
            `}
          >
            <SliceAdder />
          </Tabs.TabPane>
          <Tabs.TabPane key={2} tab={t('Layout elements')}>
            <NewTabs />
            {/* <NewRow /> */}
            {/* <NewColumn /> */}
            <NewHeader />
            <NewMarkdown />
            <NewDivider />
            {dashboardComponents
              .getAll()
              .map(({ key: componentKey, metadata }) => (
                <NewDynamicComponent
                  metadata={metadata}
                  componentKey={componentKey}
                />
              ))}
          </Tabs.TabPane>
        </Tabs>
      </div>
    </Draggable>
  );
};

export default BuilderComponentPane;
