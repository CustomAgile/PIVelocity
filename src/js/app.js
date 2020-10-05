Ext.define('PIVelocityChartApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    layout: {
        type: 'vbox',
        align: 'stretch'
    },
    autoScroll: false,

    requires: [
        'Calculator'
    ],

    items: [
        {
            xtype: 'container',
            itemId: 'filter-area',
            layout: {
                type: 'vbox',
                align: 'stretch'
            }
        },
        {
            xtype: 'container',
            itemId: 'controls-area',
            layout: 'hbox',
            margin: '10 0 0 0'
        },
        {
            id: 'grid-area',
            xtype: 'container',
            flex: 1,
            type: 'vbox',
            align: 'stretch'
        }
    ],

    config: {
        defaultSettings: {
            bucketBy: 'quarter',
            piType: 'PortfolioItem/Feature',
            aggregateBy: 'count',
            query: ''
        }
    },

    launch: function () {
        Rally.data.wsapi.Proxy.superclass.timeout = 180000;
        Rally.data.wsapi.batch.Proxy.superclass.timeout = 180000;

        // Override for comboboxes to properly apply a state when the 
        // data store was generated locally
        Ext.override(Rally.ui.combobox.ComboBox, {
            applyState: function (state) {
                if (this.store.loading) {
                    this.store.on('load', function () {
                        this.setValue(state.value);
                        this.saveState();
                    }, this, { single: true });
                }
                else {
                    this.setValue(state.value);
                    this.saveState();
                }
            }
        });

        this.labelWidth = 240;
        this.loading = true;
        this.down('#grid-area').on('resize', this.resizeChart, this);
        this.addLayoutItems();
        this.wrap(Rally.data.util.PortfolioItemHelper.getPortfolioItemTypes())
            .then(types => this.addSettingItems(types))
            .then(() => this.addControls())
            .then(() => this.addMultiFilter())
            .catch(e => this.showError(e));
    },

    resizeChart: function () {
        var gridArea = this.down('#grid-area');
        var gridboard = this.down('rallygridboard');
        if (gridArea && gridboard) {
            gridboard.setHeight(gridArea.getHeight());
        }
    },

    addLayoutItems: function () {
        let filterContainers = [{
            id: Utils.AncestorPiAppFilter.RENDER_AREA_ID,
            xtype: 'container',
            layout: { type: 'hbox', align: 'middle', defaultMargins: '0 10 10 0' }
        }, {
            id: Utils.AncestorPiAppFilter.PANEL_RENDER_AREA_ID,
            xtype: 'container',
            layout: { type: 'hbox', align: 'middle', defaultMargins: '0 10 10 0' }
        }];

        if (this.getSetting('showSettingsOnFront')) {
            this.down('#filter-area').add({
                xtype: 'tabpanel',
                itemId: 'filterAndSettingsPanel',
                stateful: true,
                stateId: 'pi-velocity-filter-and-settings-panel',
                header: false,
                collapsible: true,
                animCollapse: false,
                cls: 'blue-tabs',
                activeTab: 0,
                plain: true,
                tabBar: {
                    margin: '0 0 0 100'
                },
                autoRender: true,
                minTabWidth: 140,
                items: [
                    {
                        title: 'Filters',
                        html: '',
                        itemId: 'filtersTab',
                        padding: 5,
                        items: filterContainers
                    },
                    {
                        title: 'Settings',
                        html: '',
                        itemId: 'settingsTab',
                        padding: 10,
                    }
                ]
            });
            this.addCollapseBtn();

        }
        else {
            this.down('#filter-area').add(filterContainers);
        }
    },

    addCollapseBtn: function () {
        this.collapseBtn = Ext.widget('rallybutton', {
            text: this.down('#filterAndSettingsPanel').getCollapsed() ? 'Expand Filters and Settings' : 'Collapse',
            floating: true,
            shadow: false,
            height: 21,
            handler: (btn) => {
                this.down('#filterAndSettingsPanel').toggleCollapse();
                if (btn.getText() === 'Collapse') {
                    this.ancestorFilterPlugin.hideHelpButton();
                    btn.setText('Expand Filters and Settings');
                }
                else {
                    btn.setText('Collapse');
                    this.ancestorFilterPlugin.showHelpButton();
                }
            }
        });

        this.collapseBtn.showBy(this.down('#filterAndSettingsPanel'), 'tl-tl', [0, 3]);

        // If panel is collapsed, the multifilter help button isn't rendered in its proper place
        this.shouldCollapseSettings = this.down('#filterAndSettingsPanel').getCollapsed();
        this.down('#filterAndSettingsPanel').expand(false);
    },

    addSettingItems: function (piTypes) {
        this.portfolioItemTypes = piTypes;
        this.lowestPiType = this.portfolioItemTypes[0];

        if (this.getSetting('showSettingsOnFront')) {
            let context = this.getContext();

            return new Promise((resolve) => {
                this.down('#settingsTab').add([{
                    xtype: 'rallycombobox',
                    itemId: 'artifactTypeCombo',
                    value: this.getSetting('piType') || this.defaultSettings.piType,
                    stateful: true,
                    stateId: context.getScopedStateId('pi-velocity-artifact-type-combo'),
                    stateEvents: ['change'],
                    fieldLabel: 'Type',
                    width: 300,
                    labelWidth: 120,
                    store: {
                        fields: ['Name', 'TypePath'],
                        data: this.portfolioItemTypes
                    },
                    queryMode: 'local',
                    displayField: 'Name',
                    valueField: 'TypePath',
                    listeners: {
                        scope: this,
                        ready: () => resolve(),
                        change: function (combo, newValue, oldValue) {
                            if (this.loading) { return; }
                            if (newValue !== oldValue) { this.showApplySettingsBtn(); }
                        }
                    }
                },
                {
                    xtype: 'rallycombobox',
                    itemId: 'aggregateByCombo',
                    plugins: ['rallyfieldvalidationui'],
                    fieldLabel: 'Aggregate By',
                    displayField: 'name',
                    valueField: 'value',
                    value: this.getSetting('aggregateBy') || this.defaultSettings.aggregateBy,
                    stateful: true,
                    stateId: context.getScopedStateId('pi-velocity-aggregate-by-combo'),
                    stateEvents: ['change'],
                    editable: false,
                    allowBlank: false,
                    labelWidth: 120,
                    width: 300,
                    store: {
                        fields: ['name', 'value'],
                        data: [
                            { name: 'Accepted Leaf Story Count', value: 'AcceptedLeafStoryCount' },
                            { name: 'Accepted Leaf Story Plan Estimate', value: 'AcceptedLeafStoryPlanEstimateTotal' },
                            { name: 'Count', value: 'count' },
                            { name: 'Leaf Story Count', value: 'LeafStoryCount' },
                            { name: 'Leaf Story Plan Estimate', value: 'LeafStoryPlanEstimateTotal' },
                            { name: 'Preliminary Estimate', value: 'PreliminaryEstimateValue' },
                            { name: 'Refined Estimate', value: 'RefinedEstimate' }
                        ]
                    },
                    lastQuery: '',
                    listeners: {
                        scope: this,
                        change: function (combo, newValue, oldValue) {
                            if (this.loading) { return; }
                            if (newValue !== oldValue) { this.showApplySettingsBtn(); }
                        }
                    }
                },
                {
                    xtype: 'rallycombobox',
                    itemId: 'bucketByCombo',
                    plugins: ['rallyfieldvalidationui'],
                    fieldLabel: 'Bucket By',
                    displayField: 'name',
                    valueField: 'value',
                    value: this.getSetting('bucketBy') || this.defaultSettings.bucketBy,
                    stateful: true,
                    stateId: context.getScopedStateId('pi-velocity-bucket-by-combo'),
                    stateEvents: ['change'],
                    editable: false,
                    allowBlank: false,
                    labelWidth: 120,
                    width: 300,
                    store: {
                        fields: ['name', 'value'],
                        data: [
                            { name: 'Month', value: 'month' },
                            { name: 'Quarter', value: 'quarter' },
                            { name: 'Release', value: 'release' },
                            { name: 'Year', value: 'year' }
                        ]
                    },
                    lastQuery: '',
                    listeners: {
                        scope: this,
                        change: function (combo, newValue, oldValue) {
                            if (this.loading) { return; }
                            if (newValue !== oldValue) { this.showApplySettingsBtn(); }
                        }
                    }
                }, {
                    xtype: 'rallybutton',
                    itemId: 'applySettingsBtn',
                    text: 'Apply',
                    hidden: true,
                    handler: function (btn) {
                        btn.hide();
                        this.update();
                    }.bind(this)
                }]);
            });
        }
    },

    addControls: function () {
        let context = this.getContext();
        let type = this.getType();

        return new Promise((resolve) => {
            this.down('#controls-area').add([
                { xtype: 'container', flex: 1 },
                {
                    xtype: 'customagilefieldpicker',
                    itemId: 'fieldPickerBtn',
                    margin: '0 10 5 0',
                    toolTipConfig: { html: 'Columns to Export', anchor: 'top' },
                    getTitle: () => 'Export Columns',
                    models: [type],
                    context,
                    stateId: context.getScopedStateId(type + 'fields'),
                    alwaysSelectedValues: ['FormattedID', 'Name', 'ActualStartDate', 'ActualEndDate'],
                    selectedFields: [
                        { displayName: 'Formatted ID', fieldName: 'FormattedID' },
                        { displayName: 'Name', fieldName: 'Name' },
                        { displayName: 'Actual Start Date', fieldName: 'ActualStartDate' },
                        { displayName: 'Actual End Date', fieldName: 'ActualEndDate' },
                        { displayName: 'State', fieldName: 'State' },
                        { displayName: 'Release', fieldName: 'Release' }
                    ],
                    listeners: {
                        ready: () => resolve(),
                        fieldschanged: this.update,
                        scope: this
                    }
                }, {
                    xtype: 'rallybutton',
                    style: { 'float': 'right' },
                    cls: 'secondary rly-small',
                    frame: false,
                    itemId: 'actions-menu-button',
                    iconCls: 'icon-export',
                    toolTipConfig: {
                        html: 'Export',
                        anchor: 'top'
                    },
                    listeners: {
                        click: function (button) {
                            var menu = Ext.widget({
                                xtype: 'rallymenu',
                                items: [{
                                    text: 'Export Summary',
                                    handler: () => this.exportSummary()
                                }, {
                                    text: 'Export Raw Data',
                                    handler: () => this.exportRawData()
                                }]
                            });
                            menu.showBy(button.getEl());
                            if (button.toolTip) {
                                button.toolTip.hide();
                            }
                        },
                        scope: this
                    }
                }]);
        });
    },

    addMultiFilter: function () {
        if (this.getSetting('showSettingsOnFront')) {
            // After closing the settings window, hide the filter help button if the filter tab isn't active
            this.on('beforeshow', () => {
                if (this.down('#filterAndSettingsPanel').getActiveTab().title.indexOf('FILTERS') === -1) {
                    setTimeout(() => this.ancestorFilterPlugin.hideHelpButton(), 1000);
                }
            });
        }

        this.down('#' + Utils.AncestorPiAppFilter.RENDER_AREA_ID).add({
            xtype: 'rallybutton',
            itemId: 'applyFiltersBtn',
            handler: () => this.update(),
            text: 'Apply filters',
            cls: 'apply-filters-button',
            disabled: true
        });

        this.ancestorFilterPlugin = Ext.create('Utils.AncestorPiAppFilter', {
            ptype: 'UtilsAncestorPiAppFilter',
            pluginId: 'ancestorFilterPlugin',
            settingsConfig: { labelWidth: this.labelWidth },
            filtersHidden: false,
            projectScope: 'user',
            displayMultiLevelFilter: true,
            // disableGlobalScope: true,
            visibleTab: this.down('#artifactTypeCombo') && this.down('#artifactTypeCombo').getValue() || this.getSetting('piType'),
            listeners: {
                scope: this,
                ready(plugin) {
                    plugin.addListener({
                        scope: this,
                        select: () => this.filtersChange(plugin.getMultiLevelFilters()),
                        change: this.filtersChange
                    });

                    if (this.getSetting('showSettingsOnFront')) {
                        this.updateFilterTabText(plugin.getMultiLevelFilters());

                        this.down('#filterAndSettingsPanel').on('beforetabchange', (tabs, newTab) => {
                            if (newTab.title.indexOf('FILTERS') > -1) {
                                this.ancestorFilterPlugin.showHelpButton();
                            }
                            else {
                                this.ancestorFilterPlugin.hideHelpButton();
                            }
                        });

                        // If panel is collapsed, the multifilter help button isn't rendered in its proper place
                        if (this.shouldCollapseSettings) {
                            this.down('#filterAndSettingsPanel').collapse();
                            this.ancestorFilterPlugin.hideHelpButton();
                        }
                    }

                    setTimeout(() => {
                        if (this.ancestorFilterPlugin._isSubscriber() && this.down('#applyFiltersBtn')) {
                            this.down('#applyFiltersBtn').hide();
                        }
                    }, 500);

                    this.loading = false;
                    this.update();
                },
            }
        });
        this.addPlugin(this.ancestorFilterPlugin);
    },

    filtersChange: function (filters) {
        this.updateFilterTabText(filters);

        if (this.ancestorFilterPlugin._isSubscriber()) {
            this.update();
        }
        else {
            this.down('#applyFiltersBtn').enable();
        }
    },

    applyFilters: async function (status) {
        status = status || this.cancelPreviousLoad();
        this.setLoading('Loading Filters');
        this.down('#applyFiltersBtn').disable();
        this.ancestorAndMultiFilters = await this.ancestorFilterPlugin.getAllFiltersForType(this.model.typePath, true).catch((e) => {
            this.showError(e);
        });

        if (this.ancestorAndMultiFilters && !status.cancelLoad) {
            this._addChart();
        }
    },

    update: async function () {
        if (this.loading) { return; }

        let status = this.cancelPreviousLoad();

        if (!this.model || this.getType().toLowerCase() !== this.model.typePath.toLowerCase()) {
            await this._loadPIModel().then(model => this.model = model).catch(e => this.showError(e));
        }

        if (this.model && !status.cancelLoad) { this.applyFilters(status); }
    },

    cancelPreviousLoad() {
        if (this.globalStatus) {
            this.globalStatus.cancelLoad = true;
        }

        let newStatus = { cancelLoad: false };
        this.globalStatus = newStatus;
        return newStatus;
    },

    _loadPIModel: function () {
        this.setLoading('Loading Model');
        return this.wrap(Rally.data.wsapi.ModelFactory.getModel({ type: this.getType() }));
    },

    _addChart: function () {
        this.down('#grid-area').removeAll();
        this.setLoading('Loading Chart');
        let context = this.getContext();
        let modelNames = [this.model.typePath];

        this.down('#grid-area').add({
            xtype: 'rallygridboard',
            toggleState: 'chart',
            chartConfig: this._getChartConfig(),
            context: context,
            modelNames: modelNames,
            storeConfig: {
                filters: this._getFilters(),
                listeners: {
                    scope: this,
                    load: function () {
                        this.setLoading(false);
                        this.resizeChart();
                    },
                }
            }
        });
    },

    _getChartConfig: function () {
        let context = this.getContext().getDataContext();
        if (this.ancestorFilterPlugin.getIgnoreProjectScope()) {
            context.project = null;
        }

        return {
            xtype: 'rallychart',
            chartColors: this._isByRelease() ?
                ["#CCCCCC", "#00a9e0", "#009933"] : ["#009933"],
            storeType: 'Rally.data.wsapi.Store',
            storeConfig: {
                context,
                limit: 20000,
                fetch: this._getChartFetch(),
                sorters: this._getChartSort(),
                pageSize: 2000,
                model: this.model
            },
            calculatorType: 'Calculator',
            calculatorConfig: {
                bucketBy: this.getBucketBy(),
                aggregateBy: this.getAggregateBy()
            },
            chartConfig: {
                chart: { type: 'column' },
                legend: { enabled: this._isByRelease() },
                title: {
                    text: ''
                },
                yAxis: {
                    min: 0,
                    title: {
                        text: this._getYAxisLabel()
                    },
                    stackLabels: {
                        enabled: true,
                        style: {
                            fontWeight: 'bold',
                            color: 'gray'
                        }
                    },
                    reversedStacks: true
                },
                plotOptions: {
                    column: {
                        stacking: 'normal',
                        dataLabels: {
                            enabled: false
                        },
                        showInLegend: true,
                        colorByPoint: false
                    }
                }
            }
        };
    },

    _getFilters: function () {
        var queries = [];

        if (this._isByRelease()) {
            queries.push({
                property: 'Release',
                operator: '!=',
                value: null
            });
        } else {
            queries.push({
                property: 'ActualEndDate',
                operator: '!=',
                value: null
            });
        }

        var timeboxScope = this.getContext().getTimeboxScope();
        if (timeboxScope && timeboxScope.isApplicable(this.model) && !this._isByRelease()) {
            queries.push(timeboxScope.getQueryFilter());
        }
        if (this.getSetting('query')) {
            queries.push(Rally.data.QueryFilter.fromQueryString(this.getSetting('query')));
        }

        if (this.ancestorAndMultiFilters && this.ancestorAndMultiFilters.length) {
            queries = queries.concat(this.ancestorAndMultiFilters);
        }

        return queries;
    },

    getSettingsFields: function () {
        return [
            {
                name: 'piType',
                xtype: 'rallycombobox',
                plugins: ['rallyfieldvalidationui'],
                allowBlank: false,
                editable: false,
                autoSelect: false,
                validateOnChange: false,
                validateOnBlur: false,
                fieldLabel: 'Type',
                labelWidth: this.labelWidth,
                shouldRespondToScopeChange: true,
                storeConfig: {
                    model: 'TypeDefinition',
                    sorters: [{ property: 'Ordinal' }],
                    fetch: ['DisplayName', 'TypePath'],
                    filters: [
                        { property: 'Parent.Name', value: 'Portfolio Item' },
                        { property: 'Creatable', value: true }
                    ],
                    autoLoad: false,
                    remoteFilter: true,
                    remoteSort: true
                },
                displayField: 'DisplayName',
                valueField: 'TypePath',
                listeners: {
                    change: function (combo) {
                        combo.fireEvent('typeselected', combo.getValue(), combo.context);
                    },
                    ready: function (combo) {
                        combo.fireEvent('typeselected', combo.getValue(), combo.context);
                    }
                },
                bubbleEvents: ['typeselected'],
                readyEvent: 'ready',
                handlesEvents: {
                    projectscopechanged: function (context) {
                        this.refreshWithNewContext(context);
                    }
                }
            },
            {
                name: 'aggregateBy',
                xtype: 'rallycombobox',
                plugins: ['rallyfieldvalidationui'],
                fieldLabel: 'Aggregate By',
                labelWidth: this.labelWidth,
                displayField: 'name',
                valueField: 'value',
                editable: false,
                allowBlank: false,
                store: {
                    fields: ['name', 'value'],
                    data: [
                        { name: 'Accepted Leaf Story Count', value: 'AcceptedLeafStoryCount' },
                        { name: 'Accepted Leaf Story Plan Estimate', value: 'AcceptedLeafStoryPlanEstimateTotal' },
                        { name: 'Count', value: 'count' },
                        { name: 'Leaf Story Count', value: 'LeafStoryCount' },
                        { name: 'Leaf Story Plan Estimate', value: 'LeafStoryPlanEstimateTotal' },
                        { name: 'Preliminary Estimate', value: 'PreliminaryEstimateValue' },
                        { name: 'Refined Estimate', value: 'RefinedEstimate' }
                    ]
                },
                lastQuery: ''
            },
            {
                name: 'bucketBy',
                xtype: 'rallycombobox',
                plugins: ['rallyfieldvalidationui'],
                fieldLabel: 'Bucket By',
                labelWidth: this.labelWidth,
                displayField: 'name',
                valueField: 'value',
                editable: false,
                allowBlank: false,
                store: {
                    fields: ['name', 'value'],
                    data: [
                        { name: 'Month', value: 'month' },
                        { name: 'Quarter', value: 'quarter' },
                        { name: 'Release', value: 'release' },
                        { name: 'Year', value: 'year' }
                    ]
                },
                lastQuery: '',
                handlesEvents: {
                    typeselected: function (type) {
                        Rally.data.ModelFactory.getModel({
                            type: type,
                            success: function (model) {
                                this.store.filterBy(function (record) {
                                    return record.get('value') !== 'release' ||
                                        model.typeDefinition.Ordinal === 0;
                                });
                                if (!this.store.findRecord('value', this.getValue())) {
                                    this.setValue('month');
                                }
                            },
                            scope: this
                        });
                    }
                }
            },
            {
                name: 'showSettingsOnFront',
                xtype: 'rallycheckboxfield',
                fieldLabel: 'Show Settings On Front',
                labelWidth: this.labelWidth
            },
            {
                type: 'query'
            }
        ];
    },

    updateFilterTabText: function (filters) {
        if (this.getSetting('showSettingsOnFront')) {
            var totalFilters = 0;
            _.each(filters, function (filter) {
                totalFilters += filter.length;
            });

            var titleText = totalFilters ? `FILTERS (${totalFilters})` : 'FILTERS';
            var tab = this.down('#filterAndSettingsPanel').child('#filtersTab');

            if (tab) { tab.setTitle(titleText); }
        }
    },

    exportSummary: function () {
        let row;
        let chart = this.down('rallygridboard') && this.down('rallygridboard').getGridOrBoard();

        if (chart && typeof chart.loadedStores === 'object') {
            let csv = [[this.getBucketByDisplayName(), ...chart.chartData.categories]];
            for (let s of chart.chartData.series) {
                console.log(s);
                row = [`${this.getAggregateByDisplayName()} (${s.name})`];
                for (let d of s.data) {
                    if (typeof d === 'number') {
                        row.push(d);
                    }
                    else {
                        row.push(d.length ? d[d.length - 1] : 0);
                    }
                }
                csv.push(row);
            }

            try {
                csv = Papa.unparse(csv);
                CArABU.technicalservices.FileUtilities.saveCSVToFile(csv, 'PI_Throughput_Velocity.csv');
            } catch (e) { this.showError(e); }
        }
        else {
            this.showError('No data to export');
        }
    },

    exportRawData: function () {
        let chart = this.down('rallygridboard') && this.down('rallygridboard').getGridOrBoard();

        if (chart && typeof chart.loadedStores === 'object') {
            let aggregate = this.getAggregateBy();
            let records = chart.loadedStores.getRange();
            let header = this.getSelectedFieldDisplayNames();
            let fields = this.getSelectedFields();
            let row;

            if (aggregate !== 'count') {
                header.push(this.getAggregateByDisplayName());
                fields.push(aggregate);
            }

            let csv = [header];

            for (let r of records) {
                row = [];
                for (let f of fields) {
                    row.push(CustomAgile.ui.renderer.RecordFieldRendererFactory.getFieldDisplayValue(r, f, '; ', true));
                }
                csv.push(row);
            }
            try {
                csv = Papa.unparse(csv);
                CArABU.technicalservices.FileUtilities.saveCSVToFile(csv, 'PI_Throughput_Velocity_raw.csv');
            } catch (e) { this.showError(e); }
        }
        else {
            this.showError('No data to export');
        }
    },

    getSelectedFields() {
        return _.map(this.down('#fieldPickerBtn').getFields(), f => f.fieldName);
    },

    getSelectedFieldDisplayNames() {
        return _.map(this.down('#fieldPickerBtn').getFields(), f => f.displayName);
    },

    onTimeboxScopeChange: function () {
        this.callParent(arguments);
        this.update();
    },

    getType: function () {
        return this.down('#artifactTypeCombo') && this.down('#artifactTypeCombo').getValue() || this.getSetting('piType');
    },

    isLowestPiType: function () {
        return this.lowestPiType && this.lowestPiType.get('TypePath').toLowerCase() === this.getType().toLowerCase();
    },

    getAggregateBy: function () {
        return this.down('#aggregateByCombo') && this.down('#aggregateByCombo').getValue() || this.getSetting('aggregateBy');
    },

    getAggregateByDisplayName: function () {
        return this.down('#aggregateByCombo') && this.down('#aggregateByCombo').getDisplayValue() || this.getSetting('aggregateBy');
    },

    getBucketBy: function () {
        return this.down('#bucketByCombo') && this.down('#bucketByCombo').getValue() || this.getSetting('bucketBy');
    },

    getBucketByDisplayName: function () {
        return this.down('#bucketByCombo') && this.down('#bucketByCombo').getDisplayValue() || this.getSetting('bucketBy');
    },

    showApplySettingsBtn: function () {
        this.down('#applySettingsBtn').show();
    },

    _getYAxisLabel: function () {
        var estimateUnitName = this.getContext().getWorkspace().WorkspaceConfiguration.ReleaseEstimateUnitName;
        return this.getAggregateBy().indexOf('count') >= 0 ? 'Count' : estimateUnitName;
    },

    _getChartFetch: function () {
        return _.uniq(_.compact(['ActualStartDate', 'ActualEndDate', ...(this.isLowestPiType() ? ['Release'] : []), this.getAggregateBy(), ...this.getSelectedFields()]));
    },

    _getChartSort: function () {
        if (this._isByRelease()) {
            return [{ property: 'Release.ReleaseDate', direction: 'ASC' }];
        } else {
            return [{ property: 'ActualEndDate', direction: 'ASC' }];
        }
    },

    _isByRelease: function () {
        return this.getBucketBy() === 'release';
    },

    showError(msg, defaultMessage) {
        this.setLoading(false);
        Rally.ui.notify.Notifier.showError({ message: this.parseError(msg, defaultMessage) });
    },

    parseError(e, defaultMessage) {
        defaultMessage = defaultMessage || 'An unknown error has occurred';

        if (typeof e === 'string' && e.length) {
            return e;
        }
        if (e.message && e.message.length) {
            return e.message;
        }
        if (e.exception && e.error && e.error.errors && e.error.errors.length) {
            if (e.error.errors[0].length) {
                return e.error.errors[0];
            } else {
                if (e.error && e.error.response && e.error.response.status) {
                    return `${defaultMessage} (Status ${e.error.response.status})`;
                }
            }
        }
        if (e.exceptions && e.exceptions.length && e.exceptions[0].error) {
            return e.exceptions[0].error.statusText;
        }
        if (e.exception && e.error && typeof e.error.statusText === 'string' && !e.error.statusText.length && e.error.status && e.error.status === 524) {
            return 'The server request has timed out';
        }
        return defaultMessage;
    },

    async wrap(deferred) {
        if (!deferred || !_.isFunction(deferred.then)) {
            return Promise.reject(new Error('Wrap cannot process this type of data into a ECMA promise'));
        }
        return new Promise((resolve, reject) => {
            deferred.then({
                success(...args) {
                    resolve(...args);
                },
                failure(error) {
                    Rally.getApp().setLoading(false);
                    reject(error);
                },
                scope: this
            });
        });
    },

    showSettings: function () {
        if (this.collapseBtn) { this.collapseBtn.hide(); }
        this.callParent(arguments);
    },

    hideSettings: function () {
        if (this.collapseBtn) { this.collapseBtn.show(); }
        this.callParent(arguments);
    },

    setLoading(msg) {
        this.down('#grid-area').setLoading(msg);
    }
});
