import React, { PureComponent } from "react";
import { UserPreferences } from "../../model/preferences";
import { FormControl, FormLabel, FormGroup, FormControlLabel, Switch, FormHelperText } from "@material-ui/core";
import TitlePaper from "../title-paper";

type Props = {
    preferences: UserPreferences;
    onChange: (preferences: UserPreferences) => void;
};

/**
 * A page that allows users to update their preferences.
 */
class PreferencesPage extends PureComponent<Props> {
    onChangeBoolean(event: React.ChangeEvent<HTMLInputElement>, checked: boolean) {
        this.props.onChange({
            ...this.props.preferences,
            [event.target.name]: checked
        });
    }

    render() {
        return <TitlePaper title="Preferences">
            <FormControl component="fieldset">
                <FormLabel component="legend">User Interface</FormLabel>
                <FormGroup>
                    <FormControlLabel
                        control={<Switch
                            checked={this.props.preferences.collapseDescriptionsByDefault}
                            name="collapseDescriptionsByDefault"
                            color="primary"
                            onChange={this.onChangeBoolean.bind(this)} />}
                        label="Collapse vote option descriptions by default" />
                </FormGroup>
                <FormHelperText>
                    These preferences are local to this device.
                    If you use a different device or browser, you will need to reconfigure them.
                </FormHelperText>
            </FormControl>
        </TitlePaper>;
    }
}

export default PreferencesPage;
