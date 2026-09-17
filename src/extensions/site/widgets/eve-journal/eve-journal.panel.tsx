import React, { type FC, useState, useEffect, useCallback } from 'react';
import { widget } from '@wix/editor';
import {
  SidePanel,
  WixDesignSystemProvider,
  Input,
  FormField,
  SectionHelper,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';

const Panel: FC = () => {
  const [gardenPath, setGardenPath] = useState<string>('/my-eve-garden');

  useEffect(() => {
    widget.getProp('garden-path')
      .then((value) => setGardenPath(value || '/my-eve-garden'))
      .catch((error) => console.error('Failed to fetch garden-path:', error));
  }, []);

  const handleGardenPathChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setGardenPath(value);
    widget.setProp('garden-path', value);
  }, []);

  return (
    <WixDesignSystemProvider>
      <SidePanel width="300" height="100vh">
        <SidePanel.Content noPadding stretchVertically>
          <SidePanel.Field>
            <FormField label="My Eve Garden page path">
              <Input
                type="text"
                value={gardenPath}
                onChange={handleGardenPathChange}
                aria-label="My Eve Garden page path"
              />
            </FormField>
          </SidePanel.Field>
        </SidePanel.Content>
        <SidePanel.Footer noPadding>
          <SectionHelper fullWidth appearance="success" border="topBottom">
            Private entries are saved to Eve Journal Entries and opened from this page path.
          </SectionHelper>
        </SidePanel.Footer>
      </SidePanel>
    </WixDesignSystemProvider>
  );
};

export default Panel;
