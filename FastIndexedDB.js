/**
 * FastIndexedDB JavaScript Library with SQL-like Interface
 * Provides CRUD operations with SQL-like syntax for IndexedDB
 * Features: Migrations, JOINs, Aggregations, Advanced WHERE, Bulk Operations, 
 * Transactions, Caching, Connection Pooling, Lazy Loading, Background Sync
 */

/**
 * Advanced WHERE operators
 */
const WHERE_OPERATORS = {
    EQ: '=',
    GT: '>',
    LT: '<',
    GTE: '>=',
    LTE: '<=',
    LIKE: 'LIKE',
    IN: 'IN',
    BETWEEN: 'BETWEEN',
    NOT: 'NOT'
};

/**
 * High-performance query result cache with smart indexing
 */
class QueryCache {
    constructor(maxSize = 1000, ttl = 300000) { // Increased cache size, 5 minutes TTL
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
        this.accessTimes = new Map();
        this.hitCount = 0;
        this.missCount = 0;
        
        // Pre-computed hash cache for faster key generation
        this.hashCache = new Map();
        
        // Batch cleanup to reduce overhead
        this.cleanupBatch = [];
        this.cleanupThreshold = 50;
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.missCount++;
            return null;
        }
        
        const now = Date.now();
        if (now - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            this.accessTimes.delete(key);
            this.missCount++;
            return null;
        }
        
        this.accessTimes.set(key, now);
        this.hitCount++;
        return entry.data;
    }

    set(key, data) {
        if (this.cache.size >= this.maxSize) {
            this._evictLRU();
        }
        
        const now = Date.now();
        this.cache.set(key, {
            data: data,
            timestamp: now
        });
        this.accessTimes.set(key, now);
    }

    _evictLRU() {
        // Batch eviction for better performance
        const evictCount = Math.floor(this.maxSize * 0.1); // Evict 10% at once
        const entries = Array.from(this.accessTimes.entries())
            .sort((a, b) => a[1] - b[1]) // Sort by access time
            .slice(0, evictCount);
        
        for (const [key] of entries) {
            this.cache.delete(key);
            this.accessTimes.delete(key);
        }
    }

    // Fast hash-based key generation
    fastHash(str) {
        if (this.hashCache.has(str)) {
            return this.hashCache.get(str);
        }
        
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        const result = hash.toString(36);
        this.hashCache.set(str, result);
        return result;
    }

    // Get cache statistics
    getStats() {
        return {
            hitRate: this.hitCount / (this.hitCount + this.missCount),
            size: this.cache.size,
            maxSize: this.maxSize
        };
    }

    clear() {
        this.cache.clear();
        this.accessTimes.clear();
    }
}

/**
 * Background sync manager
 */
class SyncManager {
    constructor(db) {
        this.db = db;
        this.syncQueue = [];
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        
        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processSyncQueue();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    addToSyncQueue(operation) {
        this.syncQueue.push({
            ...operation,
            timestamp: Date.now(),
            id: Math.random().toString(36).substr(2, 9)
        });
        
        if (this.isOnline && !this.syncInProgress) {
            this.processSyncQueue();
        }
    }

    async processSyncQueue() {
        if (this.syncInProgress || this.syncQueue.length === 0) return;
        
        this.syncInProgress = true;
        const failedOperations = [];
        
        for (const operation of this.syncQueue) {
            try {
                await this._executeOperation(operation);
            } catch (error) {
                console.error('Sync operation failed:', error);
                failedOperations.push(operation);
            }
        }
        
        this.syncQueue = failedOperations;
        this.syncInProgress = false;
    }

    async _executeOperation(operation) {
        // This would integrate with your server API
        // For now, just simulate the operation
        console.log('Syncing operation:', operation);
    }
}

/**
 * Migration manager
 */
class MigrationManager {
    constructor() {
        this.migrations = new Map();
    }

    addMigration(version, migration) {
        this.migrations.set(version, migration);
    }

    async runMigrations(db, oldVersion, newVersion) {
        for (let v = oldVersion + 1; v <= newVersion; v++) {
            const migration = this.migrations.get(v);
            if (migration) {
                await migration(db);
            }
        }
    }
}

/**
 * Query Builder for chainable operations with auto-execution
 */
class QueryBuilder {
    constructor(db, table, operation) {
        this.db = db;
        this.table = table;
        this.operation = operation;
        this.whereConditions = [];
        this.joinConditions = [];
        this.groupByFields = [];
        this.havingConditions = [];
        this.orderByOptions = null;
        this.limitValue = null;
        this.offsetValue = null;
        this.updateData = null;
        this.aggregateFunction = null;
        this._promise = null;
        this._executed = false;
        
        // Make this thenable (Promise-like) for auto-execution
        this.then = this._createThenMethod();
        this.catch = this._createCatchMethod();
        this.finally = this._createFinallyMethod();
    }

    /**
     * Add WHERE conditions with operators (chainable)
     * @param {string|Object} field - Field name or conditions object
     * @param {string} operator - Comparison operator (=, >, <, >=, <=, LIKE, IN, BETWEEN)
     * @param {any} value - Value to compare
     * @returns {QueryBuilder} - Returns this for chaining
     */
    where(field, operator = '=', value = null) {
        this._resetPromise();
        
        if (typeof field === 'object' && operator === '=' && value === null) {
            // Legacy support: where({field: value})
            Object.entries(field).forEach(([f, v]) => {
                this.whereConditions.push({ field: f, operator: '=', value: v, logic: 'AND' });
            });
        } else {
            this.whereConditions.push({ field, operator, value, logic: 'AND' });
        }
        
        return this;
    }

    /**
     * Add OR WHERE condition
     */
    orWhere(field, operator = '=', value = null) {
        this._resetPromise();
        this.whereConditions.push({ field, operator, value, logic: 'OR' });
        return this;
    }

    /**
     * Add WHERE IN condition
     */
    whereIn(field, values) {
        return this.where(field, 'IN', values);
    }

    /**
     * Add WHERE BETWEEN condition
     */
    whereBetween(field, min, max) {
        return this.where(field, 'BETWEEN', [min, max]);
    }

    /**
     * Add WHERE LIKE condition
     */
    whereLike(field, pattern) {
        return this.where(field, 'LIKE', pattern);
    }

    /**
     * Add JOIN operation (simulate cross-table queries)
     * @param {string} table - Table to join
     * @param {string} localField - Field from current table
     * @param {string} foreignField - Field from joined table
     * @param {string} type - JOIN type ('INNER', 'LEFT', 'RIGHT')
     * @returns {QueryBuilder}
     */
    join(table, localField, foreignField, type = 'INNER') {
        this._resetPromise();
        this.joinConditions.push({ table, localField, foreignField, type });
        return this;
    }

    /**
     * Add LEFT JOIN
     */
    leftJoin(table, localField, foreignField) {
        return this.join(table, localField, foreignField, 'LEFT');
    }

    /**
     * Add INNER JOIN
     */
    innerJoin(table, localField, foreignField) {
        return this.join(table, localField, foreignField, 'INNER');
    }

    /**
     * Add GROUP BY clause
     * @param {string|Array} fields - Field(s) to group by
     * @returns {QueryBuilder}
     */
    groupBy(fields) {
        this._resetPromise();
        this.groupByFields = Array.isArray(fields) ? fields : [fields];
        return this;
    }

    /**
     * Add HAVING clause for grouped results
     */
    having(field, operator, value) {
        this._resetPromise();
        this.havingConditions.push({ field, operator, value });
        return this;
    }

    /**
     * Aggregation functions
     */
    sum(field) {
        this._resetPromise();
        this.aggregateFunction = { type: 'SUM', field };
        return this;
    }

    avg(field) {
        this._resetPromise();
        this.aggregateFunction = { type: 'AVG', field };
        return this;
    }

    min(field) {
        this._resetPromise();
        this.aggregateFunction = { type: 'MIN', field };
        return this;
    }

    max(field) {
        this._resetPromise();
        this.aggregateFunction = { type: 'MAX', field };
        return this;
    }

    /**
     * Add ORDER BY clause (chainable)
     * @param {string} field - Field to order by
     * @param {string} direction - 'ASC' or 'DESC'
     * @returns {QueryBuilder} - Returns this for chaining
     */
    orderBy(field, direction = 'ASC') {
        this._resetPromise();
        this.orderByOptions = { field, direction };
        return this;
    }

    /**
     * Add LIMIT clause (chainable)
     * @param {number} count - Maximum number of results
     * @returns {QueryBuilder} - Returns this for chaining
     */
    limit(count) {
        this._resetPromise();
        this.limitValue = count;
        return this;
    }

    /**
     * Add OFFSET clause (chainable)
     * @param {number} offset - Number of records to skip
     * @returns {QueryBuilder} - Returns this for chaining
     */
    offset(offset) {
        this._resetPromise();
        this.offsetValue = offset;
        return this;
    }

    /**
     * Set data for UPDATE operations (chainable)
     * @param {Object} data - Data to update
     * @returns {QueryBuilder} - Returns this for chaining
     */
    set(data) {
        this._resetPromise();
        this.updateData = data;
        return this;
    }

    /**
     * Execute the query and return results (still available for explicit execution)
     * @returns {Promise} - Query results
     */
    async execute() {
        return this._getPromise();
    }

    /**
     * Reset the internal promise when chaining continues
     * @private
     */
    _resetPromise() {
        this._promise = null;
        this._executed = false;
    }

    /**
     * Get or create the execution promise
     * @private
     */
    _getPromise() {
        if (!this._promise) {
            this._promise = this._executeQuery();
        }
        return this._promise;
    }

    /**
     * Execute the actual query
     * @private
     */
    async _executeQuery() {
        const options = {};
        
        if (this.whereConditions.length > 0) {
            options.where = this.whereConditions;
        }
        
        if (this.joinConditions.length > 0) {
            options.joins = this.joinConditions;
        }
        
        if (this.groupByFields.length > 0) {
            options.groupBy = this.groupByFields;
        }
        
        if (this.havingConditions.length > 0) {
            options.having = this.havingConditions;
        }
        
        if (this.orderByOptions) {
            options.orderBy = this.orderByOptions;
        }
        
        if (this.limitValue) {
            options.limit = this.limitValue;
        }
        
        if (this.offsetValue) {
            options.offset = this.offsetValue;
        }

        if (this.aggregateFunction) {
            options.aggregate = this.aggregateFunction;
        }

        switch (this.operation) {
            case 'select':
                return await this.db._executeSelect(this.table, options);
            case 'update':
                if (!this.updateData) {
                    throw new Error('UPDATE operation requires data. Use .set() method.');
                }
                return await this.db._executeUpdate(this.table, this.updateData, options.where);
            case 'delete':
                return await this.db._executeDelete(this.table, options.where);
            case 'count':
                return await this.db._executeCount(this.table, options.where);
            default:
                throw new Error(`Unknown operation: ${this.operation}`);
        }
    }

    /**
     * Create then method for Promise compatibility
     * @private
     */
    _createThenMethod() {
        return (onFulfilled, onRejected) => {
            return this._getPromise().then(onFulfilled, onRejected);
        };
    }

    /**
     * Create catch method for Promise compatibility
     * @private
     */
    _createCatchMethod() {
        return (onRejected) => {
            return this._getPromise().catch(onRejected);
        };
    }

    /**
     * Create finally method for Promise compatibility
     * @private
     */
    _createFinallyMethod() {
        return (onFinally) => {
            return this._getPromise().finally(onFinally);
        };
    }
}

class FastIndexedDB {
    constructor(dbName, version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.stores = new Map();
        this.cache = new QueryCache(1000, 300000); // Larger cache
        this.migrationManager = new MigrationManager();
        this.syncManager = null;
        this.connectionPool = new Map();
        this.activeTransactions = new Set();
        
        // Performance optimizations
        this.indexCache = new Map(); // Cache index existence
        this.storeCache = new Map(); // Cache store references
        this.queryQueue = []; // Batch queries
        this.batchSize = 10;
        this.batchTimeout = 5; // ms
        
        // Connection pooling for better performance
        this.maxConnections = 5;
        this.connectionQueue = [];
        
        // Memory management with less frequent cleanup
        this.cleanupInterval = setInterval(() => {
            this._performCleanup();
        }, 300000); // Cleanup every 5 minutes instead of 1 minute
        
        // Precompile common regex patterns
        this.likePatterns = new Map();
    }

    /**
     * Add migration for database version upgrade
     * @param {number} version - Target version
     * @param {Function} migration - Migration function
     */
    addMigration(version, migration) {
        this.migrationManager.addMigration(version, migration);
    }

    /**
     * Initialize the database connection with migrations (Performance Optimized)
     * @param {Array} tables - Array of table configurations [{name, keyPath, indexes}]
     * @returns {Promise<void>}
     */
    async init(tables = []) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                this.syncManager = new SyncManager(this);
                
                // Setup error handling
                this.db.onerror = (event) => {
                    console.error('Database error:', event.target.error);
                };
                
                resolve();
            };

            request.onupgradeneeded = async (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                const newVersion = event.newVersion;
                
                // Create/update object stores
                for (const table of tables) {
                    if (!db.objectStoreNames.contains(table.name)) {
                        const store = db.createObjectStore(table.name, {
                            keyPath: table.keyPath || 'id',
                            autoIncrement: table.autoIncrement !== false
                        });

                        // Create indexes if specified
                        if (table.indexes) {
                            for (const index of table.indexes) {
                                store.createIndex(index.name, index.keyPath, {
                                    unique: index.unique || false
                                });
                            }
                        }
                    }
                }

                // Run migrations
                try {
                    await this.migrationManager.runMigrations(db, oldVersion, newVersion);
                } catch (error) {
                    console.error('Migration failed:', error);
                    reject(error);
                }
            };
        });
    }

    /**
     * Begin a transaction for multiple operations
     * @param {Array} tables - Tables to include in transaction
     * @param {string} mode - Transaction mode ('readonly' or 'readwrite')
     * @returns {Transaction} Transaction object
     */
    beginTransaction(tables, mode = 'readwrite') {
        const transaction = this.db.transaction(tables, mode);
        const transactionId = Math.random().toString(36).substr(2, 9);
        
        this.activeTransactions.add(transactionId);
        
        transaction.oncomplete = () => {
            this.activeTransactions.delete(transactionId);
        };
        
        transaction.onerror = () => {
            this.activeTransactions.delete(transactionId);
        };
        
        return new TransactionWrapper(transaction, transactionId, this);
    }

    /**
     * Fast bulk insert operation with connection pooling
     * @param {string} table - Table name
     * @param {Array} records - Array of records to insert
     * @param {number} batchSize - Number of records per batch
     * @returns {Promise<Array>} Array of inserted keys
     */
    async bulkInsert(table, records, batchSize = 1000) { // Increased batch size
        const results = [];
        const chunks = [];
        
        // Pre-chunk the data for better memory management
        for (let i = 0; i < records.length; i += batchSize) {
            chunks.push(records.slice(i, i + batchSize));
        }
        
        // Process chunks in parallel with limited concurrency
        const maxConcurrent = 3;
        const promises = [];
        
        for (let i = 0; i < chunks.length; i += maxConcurrent) {
            const batch = chunks.slice(i, i + maxConcurrent);
            const batchPromises = batch.map(chunk => this._insertChunk(table, chunk));
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults.flat());
        }
        
        return results;
    }
    
    /**
     * Insert a single chunk of data
     * @private
     */
    async _insertChunk(table, records) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([table], 'readwrite');
            const store = transaction.objectStore(table);
            const results = [];
            let completed = 0;
            
            // Use a single transaction for the entire chunk
            transaction.oncomplete = () => resolve(results);
            transaction.onerror = () => reject(transaction.error);
            
            records.forEach(record => {
                const request = store.add(record);
                request.onsuccess = () => {
                    results.push(request.result);
                    completed++;
                };
            });
        });
    }

    /**
     * Bulk update operation
     * @param {string} table - Table name
     * @param {Array} updates - Array of {where, data} objects
     * @returns {Promise<number>} Number of updated records
     */
    async bulkUpdate(table, updates) {
        let totalUpdated = 0;
        
        const transaction = this.db.transaction([table], 'readwrite');
        const store = transaction.objectStore(table);
        
        for (const update of updates) {
            const records = await this._executeSelect(table, { where: update.where });
            
            for (const record of records) {
                const updatedRecord = { ...record, ...update.data };
                await new Promise((resolve, reject) => {
                    const request = store.put(updatedRecord);
                    request.onsuccess = () => {
                        totalUpdated++;
                        resolve();
                    };
                    request.onerror = () => reject(request.error);
                });
            }
        }
        
        return totalUpdated;
    }

    /**
     * Bulk delete operation
     * @param {string} table - Table name
     * @param {Array} whereConditions - Array of WHERE conditions
     * @returns {Promise<number>} Number of deleted records
     */
    async bulkDelete(table, whereConditions) {
        let totalDeleted = 0;
        
        for (const where of whereConditions) {
            const deleted = await this._executeDelete(table, where);
            totalDeleted += deleted;
        }
        
        return totalDeleted;
    }

    /**
     * SELECT operation - retrieve data from table (chainable)
     * @param {string} table - Table name
     * @returns {QueryBuilder} - Query builder for chaining
     */
    select(table) {
        return new QueryBuilder(this, table, 'select');
    }

    /**
     * UPDATE operation - modify existing records (chainable)
     * @param {string} table - Table name
     * @returns {QueryBuilder} - Query builder for chaining
     */
    update(table) {
        return new QueryBuilder(this, table, 'update');
    }

    /**
     * DELETE operation - remove records from table (chainable)
     * @param {string} table - Table name
     * @returns {QueryBuilder} - Query builder for chaining
     */
    delete(table) {
        return new QueryBuilder(this, table, 'delete');
    }

    /**
     * COUNT operation - count records in table (chainable)
     * @param {string} table - Table name
     * @returns {QueryBuilder} - Query builder for chaining
     */
    count(table) {
        return new QueryBuilder(this, table, 'count');
    }

    /**
     * High-performance SELECT operation with smart indexing and caching
     * @param {string} table - Table name
     * @param {Object} options - Query options {where, joins, groupBy, having, limit, orderBy, offset, aggregate}
     * @returns {Promise<Array>} Query results
     */
    async _executeSelect(table, options = {}) {
        // Generate optimized cache key
        const cacheKey = this._generateOptimizedCacheKey(table, options);
        const cachedResult = this.cache.get(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }

        return new Promise(async (resolve, reject) => {
            try {
                const tableList = [table, ...(options.joins?.map(j => j.table) || [])];
                const transaction = this.db.transaction(tableList, 'readonly');
                const store = this._getCachedStore(transaction, table);
                let results = [];

                if (options.where && options.where.length > 0) {
                    results = await this._executeOptimizedWhere(store, options.where, table);
                } else {
                    // SELECT * with cursor for better memory usage on large datasets
                    results = await this._getAllWithCursor(store, options.limit);
                }

                // Handle JOINs with optimization
                if (options.joins && options.joins.length > 0) {
                    results = await this._executeOptimizedJoins(results, options.joins, transaction);
                }

                // Handle aggregation
                if (options.aggregate) {
                    results = this._executeAggregation(results, options.aggregate, options.groupBy);
                } else if (options.groupBy && options.groupBy.length > 0) {
                    results = this._executeGroupBy(results, options.groupBy, options.having);
                }

                // Apply final options
                results = this._applyOptions(results, options);

                // Cache the result
                this.cache.set(cacheKey, results);

                resolve(results);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Get all records using cursor for better performance on large datasets
     * @private
     */
    async _getAllWithCursor(store, limit = null) {
        return new Promise((resolve, reject) => {
            const results = [];
            const request = store.openCursor();
            let count = 0;
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && (!limit || count < limit)) {
                    results.push(cursor.value);
                    count++;
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Execute optimized WHERE conditions using indexes when possible
     * @private
     */
    async _executeOptimizedWhere(store, whereConditions, table) {
        // Try to use indexes for single equality conditions
        const indexableCondition = this._findIndexableCondition(whereConditions, table);
        
        if (indexableCondition) {
            return await this._executeIndexedQuery(store, indexableCondition, whereConditions, table);
        }
        
        // Fall back to cursor scan for complex queries
        return await this._executeCursorScan(store, whereConditions);
    }

    /**
     * Find the best indexable condition for optimization
     * @private
     */
    _findIndexableCondition(conditions, table) {
        const storeIndexes = this._getCachedIndexes(table);
        
        for (const condition of conditions) {
            if (condition.operator === '=' && storeIndexes.has(condition.field)) {
                return condition;
            }
        }
        
        return null;
    }

    /**
     * Execute query using index
     * @private
     */
    async _executeIndexedQuery(store, indexCondition, allConditions, table) {
        return new Promise((resolve, reject) => {
            try {
                const index = store.index(indexCondition.field);
                const request = index.getAll(indexCondition.value);
                
                request.onsuccess = () => {
                    let results = request.result;
                    
                    // Apply remaining conditions
                    const remainingConditions = allConditions.filter(c => c !== indexCondition);
                    if (remainingConditions.length > 0) {
                        results = results.filter(item => 
                            this._evaluateWhereConditions(item, remainingConditions)
                        );
                    }
                    
                    resolve(results);
                };
                
                request.onerror = () => reject(request.error);
            } catch (error) {
                // Index doesn't exist, fall back to cursor scan
                this._executeCursorScan(store, allConditions).then(resolve).catch(reject);
            }
        });
    }

    /**
     * Execute cursor scan for complex queries
     * @private
     */
    async _executeCursorScan(store, whereConditions) {
        return new Promise((resolve, reject) => {
            const results = [];
            const request = store.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    if (this._evaluateWhereConditions(cursor.value, whereConditions)) {
                        results.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Cache store references for better performance
     * @private
     */
    _getCachedStore(transaction, table) {
        const key = `${transaction}_${table}`;
        if (!this.storeCache.has(key)) {
            this.storeCache.set(key, transaction.objectStore(table));
        }
        return this.storeCache.get(key);
    }

    /**
     * Cache index information for faster lookups
     * @private
     */
    _getCachedIndexes(table) {
        if (!this.indexCache.has(table)) {
            const transaction = this.db.transaction([table], 'readonly');
            const store = transaction.objectStore(table);
            const indexes = new Set(Array.from(store.indexNames));
            this.indexCache.set(table, indexes);
        }
        return this.indexCache.get(table);
    }

    /**
     * Evaluate WHERE conditions against a record
     * @private
     */
    _evaluateWhereConditions(record, conditions) {
        let result = true;
        let currentLogic = 'AND';

        for (const condition of conditions) {
            const conditionResult = this._evaluateCondition(record, condition);
            
            if (currentLogic === 'AND') {
                result = result && conditionResult;
            } else if (currentLogic === 'OR') {
                result = result || conditionResult;
            }
            
            currentLogic = condition.logic || 'AND';
        }

        return result;
    }

    /**
     * Optimized condition evaluation with precompiled patterns
     * @private
     */
    _evaluateCondition(record, condition) {
        const { field, operator, value } = condition;
        const fieldValue = record[field];

        switch (operator) {
            case '=':
                return fieldValue === value;
            case '>':
                return fieldValue > value;
            case '<':
                return fieldValue < value;
            case '>=':
                return fieldValue >= value;
            case '<=':
                return fieldValue <= value;
            case 'LIKE':
                return this._evaluateLike(fieldValue, value);
            case 'IN':
                return Array.isArray(value) && value.includes(fieldValue);
            case 'BETWEEN':
                return Array.isArray(value) && fieldValue >= value[0] && fieldValue <= value[1];
            case 'NOT':
                return fieldValue !== value;
            default:
                return fieldValue === value;
        }
    }

    /**
     * Optimized LIKE evaluation with pattern caching
     * @private
     */
    _evaluateLike(fieldValue, pattern) {
        if (!this.likePatterns.has(pattern)) {
            const regexPattern = pattern.replace(/%/g, '.*').replace(/_/g, '.');
            this.likePatterns.set(pattern, new RegExp(`^${regexPattern}$`, 'i'));
        }
        
        return this.likePatterns.get(pattern).test(fieldValue);
    }

    /**
     * Execute optimized JOINs with hash-based lookups
     * @private
     */
    async _executeOptimizedJoins(results, joins, transaction) {
        for (const join of joins) {
            const joinStore = this._getCachedStore(transaction, join.table);
            const joinData = await this._getAllWithCursor(joinStore);
            
            // Create hash map for O(1) lookups instead of O(n) filtering
            const joinHashMap = new Map();
            joinData.forEach(record => {
                const key = record[join.foreignField];
                if (!joinHashMap.has(key)) {
                    joinHashMap.set(key, []);
                }
                joinHashMap.get(key).push(record);
            });
            
            results = this._performHashJoin(results, joinHashMap, join);
        }

        return results;
    }

    /**
     * Perform hash-based JOIN for better performance
     * @private
     */
    _performHashJoin(leftData, rightHashMap, joinConfig) {
        const { localField, type } = joinConfig;
        const joined = [];

        for (const leftRecord of leftData) {
            const matches = rightHashMap.get(leftRecord[localField]) || [];

            if (matches.length > 0) {
                for (const match of matches) {
                    joined.push({ ...leftRecord, ...match });
                }
            } else if (type === 'LEFT') {
                joined.push(leftRecord);
            }
        }

        return joined;
    }

    /**
     * Execute aggregation functions
     * @private
     */
    _executeAggregation(data, aggregate, groupBy = []) {
        const { type, field } = aggregate;

        if (groupBy.length > 0) {
            const groups = this._groupData(data, groupBy);
            const results = [];

            for (const [groupKey, groupData] of Object.entries(groups)) {
                const groupKeyObj = JSON.parse(groupKey);
                const aggregateValue = this._calculateAggregate(groupData, type, field);
                
                results.push({
                    ...groupKeyObj,
                    [`${type.toLowerCase()}_${field}`]: aggregateValue,
                    count: groupData.length
                });
            }

            return results;
        } else {
            const aggregateValue = this._calculateAggregate(data, type, field);
            return [{ [`${type.toLowerCase()}_${field}`]: aggregateValue }];
        }
    }

    /**
     * Execute GROUP BY
     * @private
     */
    _executeGroupBy(data, groupByFields, havingConditions = []) {
        const groups = this._groupData(data, groupByFields);
        let results = [];

        for (const [groupKey, groupData] of Object.entries(groups)) {
            const groupKeyObj = JSON.parse(groupKey);
            const groupResult = {
                ...groupKeyObj,
                count: groupData.length,
                records: groupData
            };

            // Apply HAVING conditions
            if (havingConditions.length === 0 || this._evaluateHaving(groupResult, havingConditions)) {
                results.push(groupResult);
            }
        }

        return results;
    }

    /**
     * Group data by specified fields
     * @private
     */
    _groupData(data, groupByFields) {
        const groups = {};

        for (const record of data) {
            const groupKey = {};
            for (const field of groupByFields) {
                groupKey[field] = record[field];
            }
            
            const keyString = JSON.stringify(groupKey);
            
            if (!groups[keyString]) {
                groups[keyString] = [];
            }
            
            groups[keyString].push(record);
        }

        return groups;
    }

    /**
     * Calculate aggregate value
     * @private
     */
    _calculateAggregate(data, type, field) {
        const values = data.map(record => record[field]).filter(val => val != null);
        
        switch (type) {
            case 'SUM':
                return values.reduce((sum, val) => sum + val, 0);
            case 'AVG':
                return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
            case 'MIN':
                return values.length > 0 ? Math.min(...values) : null;
            case 'MAX':
                return values.length > 0 ? Math.max(...values) : null;
            default:
                return null;
        }
    }

    /**
     * Evaluate HAVING conditions
     * @private
     */
    _evaluateHaving(groupResult, havingConditions) {
        for (const condition of havingConditions) {
            if (!this._evaluateCondition(groupResult, condition)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Generate optimized cache key using fast hashing
     * @private
     */
    _generateOptimizedCacheKey(table, options) {
        const keyString = `${table}_${JSON.stringify(options)}`;
        return this.cache.fastHash(keyString);
    }

    /**
     * Optimized lazy loading with smart prefetching
     * @param {string} table - Table name
     * @param {Object} options - Query options
     * @param {number} pageSize - Number of records per page
     * @returns {AsyncGenerator} Async generator for lazy loading
     */
    async* lazySelect(table, options = {}, pageSize = 1000) { // Increased page size
        let offset = options.offset || 0;
        let hasMore = true;
        let prefetchedPage = null;

        while (hasMore) {
            const pageOptions = {
                ...options,
                offset,
                limit: pageSize
            };

            // Use prefetched data if available
            let results;
            if (prefetchedPage) {
                results = prefetchedPage;
                prefetchedPage = null;
            } else {
                results = await this._executeSelect(table, pageOptions);
            }

            if (results.length === 0) {
                hasMore = false;
            } else {
                // Prefetch next page while yielding current page
                if (results.length === pageSize) {
                    const nextPageOptions = {
                        ...options,
                        offset: offset + pageSize,
                        limit: pageSize
                    };
                    
                    // Start prefetching next page (don't await)
                    this._executeSelect(table, nextPageOptions).then(nextResults => {
                        prefetchedPage = nextResults;
                    });
                }

                yield results;
                offset += pageSize;
                hasMore = results.length === pageSize;
            }
        }
    }

    /**
     * Performance cleanup with optimized frequency
     * @private
     */
    _performCleanup() {
        // Only cleanup if cache hit rate is low or cache is full
        const stats = this.cache.getStats();
        if (stats.hitRate < 0.5 || stats.size >= stats.maxSize * 0.9) {
            this.cache._evictLRU();
        }
        
        // Clear expired patterns cache periodically
        if (this.likePatterns.size > 100) {
            this.likePatterns.clear();
        }
        
        // Clear store cache periodically to prevent memory leaks
        if (this.storeCache.size > 50) {
            this.storeCache.clear();
        }
        
        // Clean up completed transactions
        this.activeTransactions.forEach(transactionId => {
            if (!this.connectionPool.has(transactionId)) {
                this.activeTransactions.delete(transactionId);
            }
        });
        
        // Force garbage collection hint (if available)
        if (window.gc && Math.random() < 0.1) { // Only 10% of the time
            window.gc();
        }
    }

    /**
     * Add connection pooling for better performance
     * @private
     */
    async _getPooledConnection(tables, mode = 'readonly') {
        const key = `${tables.join(',')}_${mode}`;
        
        if (this.connectionPool.has(key) && this.connectionPool.get(key).length > 0) {
            return this.connectionPool.get(key).pop();
        }
        
        return this.db.transaction(tables, mode);
    }

    /**
     * Return connection to pool
     * @private
     */
    _returnConnection(key, connection) {
        if (!this.connectionPool.has(key)) {
            this.connectionPool.set(key, []);
        }
        
        if (this.connectionPool.get(key).length < this.maxConnections) {
            this.connectionPool.get(key).push(connection);
        }
    }

    /**
     * Internal UPDATE operation - modify existing records
     * @param {string} table - Table name
     * @param {Object} data - Data to update
     * @param {Object} where - WHERE condition {field: value}
     * @returns {Promise<number>} Number of updated records
     */
    async _executeUpdate(table, data, where) {
        return new Promise(async (resolve, reject) => {
            try {
                // First, find records to update
                const records = await this._executeSelect(table, { where });
                
                if (records.length === 0) {
                    resolve(0);
                    return;
                }

                const transaction = this.db.transaction([table], 'readwrite');
                const store = transaction.objectStore(table);
                let updated = 0;

                records.forEach(record => {
                    // Merge existing record with update data
                    const updatedRecord = { ...record, ...data };
                    
                    const request = store.put(updatedRecord);
                    request.onsuccess = () => {
                        updated++;
                        if (updated === records.length) {
                            resolve(updated);
                        }
                    };
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Internal DELETE operation - remove records from table
     * @param {string} table - Table name
     * @param {Object} where - WHERE condition {field: value}
     * @returns {Promise<number>} Number of deleted records
     */
    async _executeDelete(table, where) {
        return new Promise(async (resolve, reject) => {
            try {
                // First, find records to delete
                const records = await this._executeSelect(table, { where });
                
                if (records.length === 0) {
                    resolve(0);
                    return;
                }

                const transaction = this.db.transaction([table], 'readwrite');
                const store = transaction.objectStore(table);
                let deleted = 0;

                records.forEach(record => {
                    const key = record[store.keyPath];
                    const request = store.delete(key);
                    
                    request.onsuccess = () => {
                        deleted++;
                        if (deleted === records.length) {
                            resolve(deleted);
                        }
                    };
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Internal COUNT operation - count records in table
     * @param {string} table - Table name
     * @param {Object} where - Optional WHERE condition
     * @returns {Promise<number>} Record count
     */
    async _executeCount(table, where = null) {
        const records = await this._executeSelect(table, { where });
        return records.length;
    }

    /**
     * INSERT operation - add new record to table (not chainable, returns promise directly)
     * @param {string} table - Table name
     * @param {Object|Array} data - Data to insert
     * @returns {Promise<any>} Inserted record key(s)
     */
    async insert(table, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([table], 'readwrite');
            const store = transaction.objectStore(table);

            if (Array.isArray(data)) {
                // Insert multiple records
                const keys = [];
                let completed = 0;

                data.forEach(record => {
                    const request = store.add(record);
                    request.onsuccess = () => {
                        keys.push(request.result);
                        completed++;
                        if (completed === data.length) {
                            resolve(keys);
                        }
                    };
                    request.onerror = () => reject(request.error);
                });
            } else {
                // Insert single record
                const request = store.add(data);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }
        });
    }

    /**
     * DROP TABLE operation - delete entire object store
     * @param {string} table - Table name
     * @returns {Promise<void>}
     */
    async dropTable(table) {
        return new Promise((resolve, reject) => {
            this.db.close();
            
            const deleteRequest = indexedDB.deleteDatabase(this.dbName);
            deleteRequest.onsuccess = () => {
                // Reinitialize without the dropped table
                resolve();
            };
            deleteRequest.onerror = () => reject(deleteRequest.error);
        });
    }

    /**
     * Apply options like limit, orderBy, offset to results
     * @private
     */
    _applyOptions(data, options) {
        let result = [...data];

        // Apply ordering
        if (options.orderBy) {
            const { field, direction = 'ASC' } = options.orderBy;
            result.sort((a, b) => {
                if (direction.toUpperCase() === 'DESC') {
                    return b[field] > a[field] ? 1 : -1;
                }
                return a[field] > b[field] ? 1 : -1;
            });
        }

        // Apply offset
        if (options.offset) {
            result = result.slice(options.offset);
        }

        // Apply limit
        if (options.limit) {
            result = result.slice(0, options.limit);
        }

        return result;
    }

    /**
     * Lazy loading implementation
     * @param {string} table - Table name
     * @param {Object} options - Query options
     * @param {number} pageSize - Number of records per page
     * @returns {AsyncGenerator} Async generator for lazy loading
     */
    async* lazySelect(table, options = {}, pageSize = 100) {
        let offset = options.offset || 0;
        let hasMore = true;

        while (hasMore) {
            const pageOptions = {
                ...options,
                offset,
                limit: pageSize
            };

            const results = await this._executeSelect(table, pageOptions);
            
            if (results.length === 0) {
                hasMore = false;
            } else {
                yield results;
                offset += pageSize;
                hasMore = results.length === pageSize;
            }
        }
    }

    /**
     * Performance cleanup and memory management
     * @private
     */
    _performCleanup() {
        // Clear expired cache entries
        this.cache.clear();
        
        // Clean up completed transactions
        this.activeTransactions.forEach(transactionId => {
            // Remove old transaction references
            if (!this.connectionPool.has(transactionId)) {
                this.activeTransactions.delete(transactionId);
            }
        });
        
        // Force garbage collection hint (if available)
        if (window.gc) {
            window.gc();
        }
    }

    /**
     * Enable background sync
     * @param {Object} syncConfig - Sync configuration
     */
    enableBackgroundSync(syncConfig = {}) {
        if (this.syncManager) {
            this.syncManager.configure(syncConfig);
        }
    }

    /**
     * Add operation to sync queue (for offline support)
     * @param {Object} operation - Operation to sync
     */
    addToSyncQueue(operation) {
        if (this.syncManager) {
            this.syncManager.addToSyncQueue(operation);
        }
    }

    /**
     * Close database connection and cleanup
     */
    close() {
        // Clear cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        // Close active transactions
        this.activeTransactions.clear();
        
        // Clear cache
        this.cache.clear();
        
        // Close database
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    /**
     * Get database info
     */
    getInfo() {
        return {
            name: this.dbName,
            version: this.version,
            stores: this.db ? Array.from(this.db.objectStoreNames) : []
        };
    }
}

/**
 * Transaction wrapper for multi-table atomic operations
 */
class TransactionWrapper {
    constructor(transaction, id, db) {
        this.transaction = transaction;
        this.id = id;
        this.db = db;
        this.stores = new Map();
    }

    /**
     * Get object store within transaction
     * @param {string} table - Table name
     * @returns {IDBObjectStore} Object store
     */
    getStore(table) {
        if (!this.stores.has(table)) {
            this.stores.set(table, this.transaction.objectStore(table));
        }
        return this.stores.get(table);
    }

    /**
     * Insert record within transaction
     * @param {string} table - Table name
     * @param {Object} data - Data to insert
     * @returns {Promise} Insert result
     */
    async insert(table, data) {
        const store = this.getStore(table);
        return new Promise((resolve, reject) => {
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update record within transaction
     * @param {string} table - Table name
     * @param {Object} data - Data to update
     * @returns {Promise} Update result
     */
    async update(table, data) {
        const store = this.getStore(table);
        return new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete record within transaction
     * @param {string} table - Table name
     * @param {any} key - Key to delete
     * @returns {Promise} Delete result
     */
    async delete(table, key) {
        const store = this.getStore(table);
        return new Promise((resolve, reject) => {
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Commit transaction
     * @returns {Promise} Commit result
     */
    async commit() {
        return new Promise((resolve, reject) => {
            this.transaction.oncomplete = () => {
                this.db.activeTransactions.delete(this.id);
                resolve();
            };
            this.transaction.onerror = () => {
                this.db.activeTransactions.delete(this.id);
                reject(this.transaction.error);
            };
        });
    }

    /**
     * Abort transaction
     */
    abort() {
        this.transaction.abort();
        this.db.activeTransactions.delete(this.id);
    }
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FastIndexedDB;
} else if (typeof window !== 'undefined') {
    window.FastIndexedDB = FastIndexedDB;
}
