/* eslint-disable react-hooks/exhaustive-deps */
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
import React, { FunctionComponent, useState, useEffect } from 'react';
import { t } from '@superset-ui/core';

import Icons from 'src/components/Icons';
import { StyledIcon } from 'src/views/CRUD/utils';
import Modal from 'src/components/Modal';
import withToasts from 'src/components/MessageToasts/withToasts';
import { Col, Input, Row, Upload } from 'antd';
import Button from 'src/components/Button';
import { AntdForm } from 'src/components';
import { FormItem } from 'src/components/Form';
import { useResource } from './useResource';
import { TemplateObject } from './types';

interface BackgroundTemplateModalProps {
  addDangerToast: (msg: string) => void;
  backgroundTemplate?: TemplateObject | null;
  onBackgroundTemplateAdd?: (backgroundTemplate?: TemplateObject) => void;
  onHide: () => void;
  show: boolean;
}

const initial: TemplateObject = {
  background_name: '',
  background_uri: [],
};

const BackgroundTemplateModal: FunctionComponent<BackgroundTemplateModalProps> =
  ({
    addDangerToast,
    onBackgroundTemplateAdd,
    onHide,
    show,
    backgroundTemplate = null,
  }) => {
    const [initialValues, setInitialValues] = useState<TemplateObject>(initial);
    const [isHidden, setIsHidden] = useState<boolean>(true);
    const isEditMode = backgroundTemplate !== null;

    const [form] = AntdForm.useForm<TemplateObject>();

    const normFile = (event: any) => {
      if (Array.isArray(event)) {
        return event;
      }
      return event?.fileList;
    };

    // backgroundTemplate fetch logic
    const {
      state: { loading, resource },
      fetchResource,
      createResource,
      updateResource,
    } = useResource(addDangerToast);

    // Functions
    const hide = () => {
      setIsHidden(true);
      setInitialValues(initial);
      form.setFieldsValue(initial);
      form.resetFields();
      onHide();
    };

    const onSave = (values: TemplateObject) => {
      if (isEditMode) {
        // Edit
        if (values?.id) {
          const current: TemplateObject = { ...values };
          const update_id = current.id;
          delete current.id;
          delete current.created_by;
          updateResource(update_id as number, current).then(response => {
            if (!response) {
              return;
            }

            if (onBackgroundTemplateAdd) {
              onBackgroundTemplateAdd();
            }

            hide();
          });
        }
      } else {
        // Create
        createResource(values).then(response => {
          if (!response) {
            return;
          }

          if (onBackgroundTemplateAdd) {
            onBackgroundTemplateAdd();
          }

          hide();
        });
      }
    };

    useEffect(() => {
      if (show && isEditMode && backgroundTemplate?.id !== null && !loading) {
        fetchResource(backgroundTemplate.id || 0);
      }
    }, [show, backgroundTemplate]);

    useEffect(() => {
      if (resource) {
        form.setFieldsValue(resource);
        setInitialValues(resource);
      }
    }, [resource]);

    // Show/hide
    if (isHidden && show) {
      setIsHidden(false);
    }

    return (
      <Modal
        onHide={hide}
        show={show}
        title={
          <h4 data-test="background-template-modal-title">
            {isEditMode ? (
              <Icons.EditAlt css={StyledIcon} />
            ) : (
              <Icons.PlusLarge css={StyledIcon} />
            )}
            {isEditMode
              ? t('Edit background template properties')
              : t('Add background template')}
          </h4>
        }
        footer={
          <>
            <Button htmlType="button" buttonSize="small" onClick={onHide} cta>
              {t('Cancel')}
            </Button>
            <Button
              onClick={form.submit}
              buttonSize="small"
              buttonStyle="primary"
              className="m-r-5"
              disabled={loading}
              cta
            >
              {isEditMode ? t('Save') : t('Add')}
            </Button>
          </>
        }
      >
        <AntdForm
          form={form}
          onFinish={onSave}
          layout="vertical"
          initialValues={initialValues}
        >
          <Row gutter={16}>
            <Col xs={24}>
              <FormItem
                label={t('Background template name')}
                name="background_name"
                rules={[
                  { required: true, message: t('This field is required.') },
                ]}
              >
                <Input type="text" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24}>
              <FormItem label={t('Description')} name="description">
                <Input type="text" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24}>
              <FormItem
                label={t('Background image')}
                name="background_uri"
                valuePropName="fileList"
                getValueFromEvent={normFile}
                rules={[
                  { required: true, message: t('This field is required.') },
                ]}
              >
                <Upload
                  name="background_uri"
                  accept=".jpg,.png,.svg"
                  multiple={false}
                  beforeUpload={() => false}
                  listType="picture"
                >
                  <Button>{t('Select file')}</Button>
                </Upload>
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <FormItem label={t('Width')} name="width">
                <Input type="text" />
              </FormItem>
            </Col>
            <Col xs={24} md={12}>
              <FormItem label={t('Height')} name="height">
                <Input type="text" />
              </FormItem>
            </Col>
          </Row>
        </AntdForm>
      </Modal>
    );
  };

export default withToasts(BackgroundTemplateModal);
