import { useCallback, useState } from 'react';
import { SupersetClient, t } from '@superset-ui/core';
import { createErrorHandler } from 'src/views/CRUD/utils';
import { SharedImageObject } from './types';

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
  resource: SharedImageObject | null;
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

  function getFormData(resource: SharedImageObject) {
    const formData = new FormData();
    formData.append('image_name', resource?.image_name);
    formData.append(
      'image_uri',
      resource?.image_uri?.[0].originFileObj as Blob,
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

      const baseEndpoint = `/api/v1/shared_image/${resourceID}`;
      const endpoint =
        path_suffix !== '' ? `${baseEndpoint}/${path_suffix}` : baseEndpoint;
      return SupersetClient.get({
        endpoint,
      })
        .then(
          ({ json = {} }) => {
            const { image_uri } = json.result;
            return fetchImage(image_uri).then(imageFile => {
              const resource: SharedImageObject = {
                ...json.result,
                image_uri: [
                  {
                    uid: '-1',
                    status: 'done',
                    url: image_uri,
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
                t('shared_image'),
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
    (resource: SharedImageObject, hideToast = false) => {
      // Set loading state
      updateState({
        loading: true,
      });

      return SupersetClient.post({
        endpoint: `/api/v1/shared_image/`,
        body: getFormData(resource),
      })
        .then(
          ({ json = {} }) => {
            const { image_uri } = json.result;
            return fetchImage(image_uri).then(imageFile => {
              const resource: SharedImageObject = {
                id: json.id,
                ...json.result,
                image_uri: [
                  {
                    uid: '-1',
                    status: 'done',
                    url: image_uri,
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
                  t('shared_image'),
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
      resource: SharedImageObject,
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
        endpoint: `/api/v1/shared_image/${resourceID}`,
        body: getFormData(resource),
      })
        .then(
          ({ json = {} }) => {
            const { image_uri } = json.result;
            return fetchImage(image_uri).then(imageFile => {
              const resource: SharedImageObject = {
                ...json.result,
                id: json.id,
                image_uri: [
                  {
                    uid: '-1',
                    status: 'done',
                    url: image_uri,
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
                  t('shared_image'),
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
    setResource: (update: SharedImageObject) =>
      updateState({
        resource: update,
      }),
    fetchResource,
    createResource,
    updateResource,
    clearError,
  };
}
