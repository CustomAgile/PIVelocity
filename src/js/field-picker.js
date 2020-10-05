Ext.define('CustomAgile.ui.FieldPicker', {
    extend: 'Rally.ui.Button',
    alias: 'widget.customagilefieldpicker',

    config: {
        stateful: true,
        stateId: 'CustomAgile.FieldPicker',
        models: [],
        selectedFields: [],
        alwaysSelectedValues: ['FormattedID', 'Name'],
        fieldBlackList: ['GrossEstimateConversionRatio', 'ObjectID', 'RevisionHistory', 'Subscription', 'Workspace', 'ObjectUUID', 'VersionId'],
        toolTipConfig: {
            html: 'Choose Fields',
            anchor: 'top'
        }
    },

    cls: 'field-picker-btn secondary rly-small',

    iconCls: 'icon-add-column',

    constructor: function (config) {
        this.mergeConfig(config);
        this.callParent([this.config]);
        this.on('click', this._onClick);
        this.fireEvent('ready');
    },

    _onClick: function (btn) {
        this._createPopover(btn.getEl());
    },

    _createPopover: function (popoverTarget) {
        this.popover = Ext.create('Rally.ui.popover.Popover', {
            target: popoverTarget,
            placement: ['bottom', 'left', 'top', 'right'],
            cls: 'field-picker-popover',
            toFront: Ext.emptyFn,
            buttonAlign: 'center',
            title: 'Choose Fields',
            listeners: {
                destroy: function () {
                    this.popover = null;
                },
                scope: this
            },
            buttons: [
                {
                    xtype: "rallybutton",
                    text: 'Apply',
                    cls: 'field-picker-apply-btn primary rly-small',
                    listeners: {
                        click: function () {
                            this._onApply(this.popover);
                        },
                        scope: this
                    }
                },
                {
                    xtype: "rallybutton",
                    text: 'Cancel',
                    cls: 'field-picker-cancel-btn secondary dark rly-small',
                    listeners: {
                        click: function () {
                            this.popover.close();
                        },
                        scope: this
                    }
                }
            ],
            items: [{
                xtype: 'rallyfieldpicker',
                cls: 'field-picker',
                itemId: 'fieldpicker',
                modelTypes: this.models,
                context: this.context,
                alwaysSelectedValues: this.alwaysSelectedValues,
                fieldBlackList: this.fieldBlackList,
                alwaysExpanded: true,
                width: 200,
                emptyText: 'Search',
                selectedTextLabel: 'Selected',
                availableTextLabel: 'Available',
                value: this.selectedFields && this.selectedFields.length ? typeof (this.selectedFields[0]) === 'string' ? this.selectedFields : _.map(this.selectedFields, f => f.fieldName) : [],
                listeners: {
                    specialkey: function (field, e) {
                        if (e.getKey() === e.ESC) {
                            this.popover.close();
                        }
                    },
                    scope: this
                }
            }]
        });
    },

    _onApply: function (popover) {
        let fieldPicker = popover.down('rallyfieldpicker');
        let fields = fieldPicker.getValue();
        this.selectedFields = _.map(fields, f => {
            return {
                displayName: f.get('displayName'),
                fieldName: f.get('name')
            };
        });
        this.saveState();
        this.fireEvent('fieldschanged', this.selectedFields);
        popover.close();
    },

    getFields: function () {
        return this.selectedFields;
    },

    getState: function () {
        return { selectedFields: this.selectedFields };
    },

    applyState: function (state) {
        this.selectedFields = state.selectedFields;
        this.fireEvent('fieldschanged', this.selectedFields);
    }
});
