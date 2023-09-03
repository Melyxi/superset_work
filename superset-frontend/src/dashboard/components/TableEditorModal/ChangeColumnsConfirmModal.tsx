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
import React, { FunctionComponent } from 'react';
import Alert from 'src/components/Alert';
import { t, styled, css } from '@superset-ui/core';
import StyledModal from 'src/components/Modal';
import Button from 'src/components/Button';
import { Col, Row, Typography } from 'src/components';
import { Tooltip } from 'src/components/Tooltip';

interface ColumnDefinition {
  name: string;
  type: string;
  description?: string;
  value: any;
}

interface ChangeColumnsConfirmModalProps {
  columns: ColumnDefinition[];
  onConfirm: () => void;
  onCancel: () => void;
  show: boolean;
}

const Modal = styled(StyledModal)`
  .ant-modal-body {
    display: flex;
    flex-direction: column;
  }
`;

const ConfirmModalStyled = styled.div`
  .btn-container {
    display: flex;
    justify-content: flex-end;
    padding: 0px 15px;
    margin: 10px 0 0 0;
  }

  .confirm-modal-container {
    margin: 9px;
  }
`;

const ChangeColumnsConfirmModal: FunctionComponent<ChangeColumnsConfirmModalProps> =
  props => {
    const { columns, onConfirm, onCancel, show } = props;

    const handleConfirm = () => {
      onConfirm();
    };

    const handlerCancel = () => {
      onCancel();
    };

    return (
      <Modal
        show={show}
        onHide={onCancel}
        responsive
        title="Изменить набор данных"
        footer={
          <ConfirmModalStyled>
            <div className="btn-container">
              <Button onClick={handlerCancel}>{t('Cancel')}</Button>
              <Button buttonStyle="primary" onClick={handleConfirm}>
                {t('Proceed')}
              </Button>
            </div>
          </ConfirmModalStyled>
        }
      >
        <Alert
          roomBelow
          type="warning"
          css={theme => ({ marginBottom: theme.gridUnit * 4 })}
          message="Проверьте корректность введенных данных."
        />
        {columns.map(({ name, description, value, type }) => (
          <Row
            gutter={16}
            css={css`
              margin-bottom: 8px;
            `}
          >
            <Col span={5}>
              <Tooltip title={name} placement="top">
                <Typography.Text strong>{description || name}</Typography.Text>
              </Tooltip>
            </Col>
            <Col span={19}>
              <Typography.Text>
                {['DATE', 'DATETIME', 'TIMESTAMP'].includes(type)
                  ? new Intl.DateTimeFormat(undefined, {
                      year: 'numeric',
                      month: 'numeric',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: 'numeric',
                      second: 'numeric',
                    }).format(new Date(value))
                  : String(value)}
              </Typography.Text>
            </Col>
          </Row>
        ))}
      </Modal>
    );
  };

export default ChangeColumnsConfirmModal;
