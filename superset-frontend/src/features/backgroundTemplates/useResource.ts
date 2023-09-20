import { useCallback, useState } from 'react';
import { SupersetClient, t } from '@superset-ui/core';
import { createErrorHandler } from 'src/views/CRUD/utils';
import { TemplateObject } from './types';

const parsedErrorMessage = (
  errorMessage: Record<string, string[] | string> | string,
) => {
  if (typeof errorMessage === 'string') {
    return errorMessage;
  }
  return Object.entries(errorMessage)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `(${key}) ${value.join(', ')}`;
      }
      return `(${key}) ${value}`;
    })
    .join('\n');
};

interface SingleViewResourceState {
  loading: boolean;
  resource: TemplateObject | null;
  error: any | null;
}

export function useResource(
  handleErrorMsg: (errorMsg: string) => void,
  path_suffix = '',
) {
  const [state, setState] = useState<SingleViewResourceState>({
    loading: false,
    resource: null,
    error: null,
  });

  function updateState(update: Partial<SingleViewResourceState>) {
    setState(currentState => ({ ...currentState, ...update }));
  }

  function getFormData(resource: TemplateObject) {
    const formData = new FormData();
    formData.append('background_name', resource?.background_name);
    formData.append(
      'background_uri',
      resource?.background_uri?.[0].originFileObj as Blob,
    );
    formData.append('description', resource.description ?? '');
    formData.append('width', resource.width ?? '');
    formData.append('height', resource.height ?? '');

    return formData;
  }

  const fetchImage = useCallback(
    (endpoint: string) =>
      SupersetClient.get<'raw'>({
        endpoint,
        parseMethod: 'raw',
        headers: {
          Accept: '*/*',
        },
      })
        .then(image => image.blob())
        .then(imageBlob => {
          const name = endpoint.split('/').pop();
          const imageFile = new File([imageBlob], name ?? '', {
            type: imageBlob.type,
          });

          return imageFile;
        }),
    [],
  );

  const fetchResource = useCallback(
    (resourceID: number) => {
      // Set loading state
      updateState({
        loading: true,
      });

      const baseEndpoint = `/api/v1/background_template/${resourceID}`;
      const endpoint =
        path_suffix !== '' ? `${baseEndpoint}/${path_suffix}` : baseEndpoint;
      return SupersetClient.get({
        endpoint,
      })
        .then(
          ({ json = {} }) => {
            const { background_uri } = json.result;
            return fetchImage(background_uri).then(imageFile => {
              const resource: TemplateObject = {
                ...json.result,
                background_uri: [
                  {
                    uid: '-1',
                    status: 'done',
                    url: background_uri,
                    name: imageFile.name,
                    size: imageFile.size,
                    originFileObj: imageFile,
                  },
                ],
              };

              updateState({
                resource,
                error: null,
              });

              return resource;
            });
          },
          createErrorHandler((errMsg: Record<string, string[] | string>) => {
            handleErrorMsg(
              t(
                'An error occurred while fetching %ss: %s',
                t('background_template'),
                parsedErrorMessage(errMsg),
              ),
            );

            updateState({
              error: errMsg,
            });
          }),
        )
        .finally(() => {
          updateState({ loading: false });
        });
    },
    [handleErrorMsg],
  );

  const createResource = useCallback(
    (resource: TemplateObject, hideToast = false) => {
      // Set loading state
      updateState({
        loading: true,
      });

      return SupersetClient.post({
        endpoint: `/api/v1/background_template/`,
        body: getFormData(resource),
      })
        .then(
          ({ json = {} }) => {
            const { background_uri } = json.result;
            return fetchImage(background_uri).then(imageFile => {
              const resource: TemplateObject = {
                id: json.id,
                ...json.result,
                background_uri: [
                  {
                    uid: '-1',
                    status: 'done',
                    url: background_uri,
                    name: imageFile.name,
                    size: imageFile.size,
                    originFileObj: imageFile,
                  },
                ],
              };

              updateState({
                resource,
                error: null,
              });

              return json.id;
            });
          },
          createErrorHandler((errMsg: Record<string, string[] | string>) => {
            // we did not want toasts for db-connection-ui but did not want to disable it everywhere
            if (!hideToast) {
              handleErrorMsg(
                t(
                  'An error occurred while creating %ss: %s',
                  t('background_template'),
                  parsedErrorMessage(errMsg),
                ),
              );
            }

            updateState({
              error: errMsg,
            });
          }),
        )
        .finally(() => {
          updateState({ loading: false });
        });
    },
    [handleErrorMsg],
  );

  const updateResource = useCallback(
    (
      resourceID: number,
      resource: TemplateObject,
      hideToast = false,
      setLoading = true,
    ) => {
      // Set loading state
      if (setLoading) {
        updateState({
          loading: true,
        });
      }

      return SupersetClient.put({
        endpoint: `/api/v1/background_template/${resourceID}`,
        body: getFormData(resource),
      })
        .then(
          ({ json = {} }) => {
            const { background_uri } = json.result;
            return fetchImage(background_uri).then(imageFile => {
              const resource: TemplateObject = {
                ...json.result,
                id: json.id,
                background_uri: [
                  {
                    uid: '-1',
                    status: 'done',
                    url: background_uri,
                    name: imageFile.name,
                    size: imageFile.size,
                    originFileObj: imageFile,
                  },
                ],
              };

              updateState({
                resource,
                error: null,
              });

              return json.result;
            });
          },
          createErrorHandler(errMsg => {
            if (!hideToast) {
              handleErrorMsg(
                t(
                  'An error occurred while fetching %ss: %s',
                  t('background_template'),
                  JSON.stringify(errMsg),
                ),
              );
            }

            updateState({
              error: errMsg,
            });

            return errMsg;
          }),
        )
        .finally(() => {
          if (setLoading) {
            updateState({ loading: false });
          }
        });
    },
    [handleErrorMsg],
  );

  const clearError = () =>
    updateState({
      error: null,
    });

  return {
    state,
    setResource: (update: TemplateObject) =>
      updateState({
        resource: update,
      }),
    fetchResource,
    createResource,
    updateResource,
    clearError,
  };
}
