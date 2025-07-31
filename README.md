# FastIndexedDB

A high-performance JavaScript library that provides SQL-like interface for IndexedDB with advanced features including migrations, JOINs, aggregations, caching, connection pooling, and background sync.

## Features

🚀 **Performance Optimizations**
- High-performance query result cache with smart indexing
- Connection pooling for better resource management
- Lazy loading and batched operations
- Optimized WHERE clause execution with index support

🔄 **SQL-like Interface**
- Chainable query builder (SELECT, INSERT, UPDATE, DELETE)
- Advanced WHERE operators (=, >, <, >=, <=, LIKE, IN, BETWEEN, NOT)
- JOIN support (INNER JOIN, LEFT JOIN)  
- Aggregation functions (COUNT, SUM, AVG, MIN, MAX)
- GROUP BY and HAVING clauses

💾 **Advanced Features**
- Database migrations and version management
- Transaction support with rollback capabilities
- Bulk operations for large datasets
- Background sync for offline-first applications
- Query result caching with TTL
- Connection pooling

## Installation

### Browser (CDN)
```html
<script src="path/to/FastIndexedDB.js"></script>
```

### ES6 Module
```javascript
import FastIndexedDB from './FastIndexedDB.js';
```

### Node.js (if using with polyfills)
```javascript
const FastIndexedDB = require('./FastIndexedDB.js');
```

## Quick Start

```javascript
// Initialize database
const db = new FastIndexedDB('MyDatabase', 1);

// Define your tables
const tables = [
    {
        name: 'users',
        keyPath: 'id',
        autoIncrement: true,
        indexes: [
            { name: 'email', keyPath: 'email', unique: true },
            { name: 'age', keyPath: 'age' }
        ]
    },
    {
        name: 'orders',
        keyPath: 'id',
        autoIncrement: true,
        indexes: [
            { name: 'userId', keyPath: 'userId' },
            { name: 'status', keyPath: 'status' }
        ]
    }
];

// Initialize database with tables
await db.init(tables);
```

## Examples

### Basic CRUD Operations

#### Simple Insert
```javascript
// Insert a single record
const userId = await db.insert('users', {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30
});
console.log('User ID:', userId);
```

#### Simple Select
```javascript
// Get all users
const allUsers = await db.select('users');

// Get specific user by ID
const user = await db.get('users', 1);
```

#### Simple Update
```javascript
// Update user""
await db.update('users')
    .set({ age: 31 })
    .where('id', '=', 1);
```

#### Simple Delete
```javascript
// Delete user""
await db.delete('users')
    .where('id', '=', 1);
```

### Advanced WHERE Clauses

```javascript
// Multiple conditions with AND""
const results = await db.select('users')
    .where('age', '>', 18)
    .and('age', '<', 65);

// OR conditions
const results = await db.select('users')
    .where('status', '=', 'active')
    .or('status', '=', 'pending');

// LIKE operator for pattern matching
const results = await db.select('users')
    .where('name', 'LIKE', 'John%');

// IN operator for multiple values
const results = await db.select('users')
    .where('age', 'IN', [25, 30, 35]);

// BETWEEN operator for ranges
const results = await db.select('users')
    .where('age', 'BETWEEN', [18, 65]);

// Complex nested conditions
const results = await db.select('users')
    .where('age', '>', 18)
    .and(builder => 
        builder.where('status', '=', 'active')
               .or('status', '=', 'premium')
    );
```

### JOINs and Relationships

```javascript
// INNER JOIN - Get users with their orders""
const usersWithOrders = await db.select('users')
    .innerJoin('orders', 'users.id', 'orders.userId');

// LEFT JOIN - Get all users, including those without orders
const allUsersWithOrders = await db.select('users')
    .leftJoin('orders', 'users.id', 'orders.userId');

// Multiple JOINs with WHERE conditions
const results = await db.select('users')
    .innerJoin('orders', 'users.id', 'orders.userId')
    .leftJoin('products', 'orders.productId', 'products.id')
    .where('users.age', '>', 25)
    .and('orders.status', '=', 'completed');
```

### Aggregations and Grouping

```javascript
// Count total users""
const userCount = await db.count('users');

// Count with conditions
const activeUserCount = await db.count('users')
    .where('status', '=', 'active');

// SUM aggregation
const totalOrderValue = await db.select('orders')
    .sum('amount');

// GROUP BY with aggregations
const ordersByStatus = await db.select('orders')
    .groupBy('status')
    .count()
    .sum('amount');

// HAVING clause for filtering groups
const highValueStatuses = await db.select('orders')
    .groupBy('status')
    .sum('amount', 'totalAmount')
    .having('totalAmount', '>', 1000);

// Multiple aggregations
const userStats = await db.select('users')
    .groupBy('department')
    .count('userCount')
    .avg('age', 'avgAge')
    .min('age', 'minAge')
    .max('age', 'maxAge');
```

### Sorting and Pagination

```javascript
// Order by single field""
const sortedUsers = await db.select('users')
    .orderBy('name', 'ASC');

// Order by multiple fields
const sortedUsers = await db.select('users')
    .orderBy('department', 'ASC')
    .orderBy('age', 'DESC');

// Pagination with LIMIT and OFFSET
const page1 = await db.select('users')
    .orderBy('id', 'ASC')
    .limit(10)
    .offset(0);

const page2 = await db.select('users')
    .orderBy('id', 'ASC')
    .limit(10)
    .offset(10);
```

### Bulk Operations

```javascript
// Bulk insert
const users = [
    { name: 'User 1', email: 'user1@example.com', age: 25 },
    { name: 'User 2', email: 'user2@example.com', age: 30 },
    { name: 'User 3', email: 'user3@example.com', age: 35 }
];

const insertedIds = await db.bulkInsert('users', users);

// Bulk update
const updates = [
    { where: [{ field: 'id', operator: '=', value: 1 }], data: { age: 26 } },
    { where: [{ field: 'id', operator: '=', value: 2 }], data: { age: 31 } }
];

const updatedCount = await db.bulkUpdate('users', updates);

// Bulk delete
const deleteConditions = [
    [{ field: 'age', operator: '<', value: 18 }],
    [{ field: 'status', operator: '=', value: 'inactive' }]
];

const deletedCount = await db.bulkDelete('users', deleteConditions);
```

### Transactions

```javascript
// Basic transaction
const transaction = await db.beginTransaction(['users', 'orders'], 'readwrite');

try {
    // Perform multiple operations
    await transaction.insert('users', { name: 'John', email: 'john@example.com' });
    await transaction.insert('orders', { userId: 1, amount: 100, status: 'pending' });
    await transaction.update('users', { lastOrderDate: new Date() }, 1);
    
    // Commit transaction
    await transaction.commit();
    console.log('Transaction completed successfully');
} catch (error) {
    // Rollback on error
    transaction.abort();
    console.error('Transaction failed:', error);
}
```

### Database Migrations

```javascript
// Add migration for version 2
db.addMigration(2, (db, transaction) => {
    // Add new object store
    const profileStore = db.createObjectStore('profiles', {
        keyPath: 'userId'
    });
    
    // Add index to existing store
    const userStore = transaction.objectStore('users');
    userStore.createIndex('createdAt', 'createdAt');
});

// Add migration for version 3
db.addMigration(3, async (db, transaction) => {
    // Data migration example
    const userStore = transaction.objectStore('users');
    const cursor = userStore.openCursor();
    
    cursor.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            const user = cursor.value;
            // Add default values for new fields
            user.status = user.status || 'active';
            user.createdAt = user.createdAt || new Date();
            cursor.update(user);
            cursor.continue();
        }
    };
});

// Initialize with version 3
const db = new FastIndexedDB('MyDatabase', 3);
await db.init(tables);
```

### Background Sync (Offline Support)

```javascript
// Enable background sync
await db.enableSync({
    syncEndpoint: 'https://api.example.com/sync',
    syncInterval: 30000, // 30 seconds
    conflictResolution: 'client-wins' // or 'server-wins'
});

// Queue operations for sync when online
await db.insert('users', { 
    name: 'Offline User', 
    email: 'offline@example.com',
    _syncPending: true 
});

// Manual sync trigger
await db.syncNow();

// Listen for sync events
db.onSyncComplete = (results) => {
    console.log('Sync completed:', results);
};

db.onSyncError = (error) => {
    console.error('Sync error:', error);
};
```

### Caching and Performance

```javascript
// Configure cache settings
const db = new FastIndexedDB('MyDatabase', 1);
db.cache.maxSize = 2000; // Increase cache size
db.cache.ttl = 600000; // 10 minutes TTL

// Cached queries (automatic)""
const users = await db.select('users').where('age', '>', 18);
// Subsequent identical queries will use cache

// Manual cache control
db.cache.clear(); // Clear all cache
db.clearCache('users'); // Clear cache for specific table

// Cache statistics
console.log('Cache hit rate:', db.cache.hitCount / (db.cache.hitCount + db.cache.missCount));
```

### Error Handling

```javascript
try {
    const result = await db.select('users')
        .where('age', '>', 18); 
} catch (error) {
    if (error.name === 'NotFoundError') {
        console.log('Table not found');
    } else if (error.name === 'DataError') {
        console.log('Invalid data');
    } else {
        console.error('Database error:', error);
    }
}

// Transaction error handling
const transaction = await db.beginTransaction(['users'], 'readwrite');
transaction.onerror = (event) => {
    console.error('Transaction error:', event.target.error);
};
```

### Complex Real-world Example

```javascript
// E-commerce order management system
class OrderManager {
    constructor() {
        this.db = new FastIndexedDB('ECommerceDB', 1);
    }

    async init() {
        const tables = [
            {
                name: 'customers',
                keyPath: 'id',
                autoIncrement: true,    
                indexes: [
                    { name: 'email', keyPath: 'email', unique: true },
                    { name: 'phone', keyPath: 'phone' },
                    { name: 'status', keyPath: 'status' }
                ]
            },
            {
                name: 'products',
                keyPath: 'id',
                autoIncrement: true,
                indexes: [
                    { name: 'sku', keyPath: 'sku', unique: true },
                    { name: 'category', keyPath: 'category' },
                    { name: 'price', keyPath: 'price' }
                ]
            },
            {
                name: 'orders',
                keyPath: 'id',
                autoIncrement: true,
                indexes: [
                    { name: 'customerId', keyPath: 'customerId' },
                    { name: 'status', keyPath: 'status' },
                    { name: 'orderDate', keyPath: 'orderDate' }
                ]
            },
            {
                name: 'orderItems',
                keyPath: 'id',
                autoIncrement: true,
                indexes: [
                    { name: 'orderId', keyPath: 'orderId' },
                    { name: 'productId', keyPath: 'productId' }
                ]
            }
        ];

        await this.db.init(tables);
    }

    // Get customer order history with product details
    async getCustomerOrderHistory(customerId) {
        return await this.db.select('orders')
            .innerJoin('customers', 'orders.customerId', 'customers.id')
            .innerJoin('orderItems', 'orders.id', 'orderItems.orderId')
            .innerJoin('products', 'orderItems.productId', 'products.id')
            .where('customers.id', '=', customerId)
            .orderBy('orders.orderDate', 'DESC'); // Auto-executes when awaited
    }

    // Get sales report by category for date range
    async getSalesReport(startDate, endDate) {
        return await this.db.select('orders')
            .innerJoin('orderItems', 'orders.id', 'orderItems.orderId')
            .innerJoin('products', 'orderItems.productId', 'products.id')
            .where('orders.orderDate', 'BETWEEN', [startDate, endDate])
            .and('orders.status', '=', 'completed')
            .groupBy('products.category')
            .sum('orderItems.quantity * orderItems.price', 'totalRevenue')
            .sum('orderItems.quantity', 'totalQuantity')
            .count('orders.id', 'orderCount')
            .orderBy('totalRevenue', 'DESC'); // Auto-executes when awaited
    }

    // Process bulk order with transaction
    async processBulkOrder(customerId, items) {
        const transaction = await this.db.beginTransaction(['orders', 'orderItems', 'products'], 'readwrite');
        
        try {
            // Create order
            const orderId = await transaction.insert('orders', {
                customerId: customerId,
                orderDate: new Date(),
                status: 'pending',
                total: 0
            });

            let totalAmount = 0;

            // Add order items and update product inventory
            for (const item of items) {
                await transaction.insert('orderItems', {
                    orderId: orderId,
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price
                });

                // Update product stock
                const product = await this.db.get('products', item.productId);
                product.stock -= item.quantity;
                await transaction.put('products', product);
                
                totalAmount += item.quantity * item.price;
            }

            // Update order total
            await transaction.update('orders', { total: totalAmount }, orderId);
            
            await transaction.commit();
            return orderId;
        } catch (error) {
            transaction.abort();
            throw error;
        }
    }
}

// Usage
const orderManager = new OrderManager();
await orderManager.init();

// Process an order
const orderId = await orderManager.processBulkOrder(1, [
    { productId: 1, quantity: 2, price: 29.99 },
    { productId: 2, quantity: 1, price: 49.99 }
]);

// Get sales report
const report = await orderManager.getSalesReport(
    new Date('2024-01-01'),
    new Date('2024-12-31')
);
```

## API Reference

### FastIndexedDB Class

#### Constructor
```javascript
new FastIndexedDB(dbName, version)
```

#### Methods

| Method | Description |
|--------|-------------|
| `init(tables)` | Initialize database with table definitions |
| `select(table)` | Start SELECT query builder |
| `insert(table, data)` | Insert single record |
| `update(table)` | Start UPDATE query builder |
| `delete(table)` | Start DELETE query builder |
| `count(table)` | Start COUNT query builder |
| `get(table, key)` | Get single record by key |
| `bulkInsert(table, records)` | Insert multiple records |
| `bulkUpdate(table, updates)` | Update multiple records |
| `bulkDelete(table, conditions)` | Delete multiple records |
| `beginTransaction(tables, mode)` | Start new transaction |
| `addMigration(version, fn)` | Add database migration |
| `enableSync(options)` | Enable background sync |
| `clearCache(table?)` | Clear query cache |


#### Chainable Methods

| Method | Description |
|--------|-------------|
| `where(field, operator, value)` | Add WHERE condition |
| `and(field, operator, value)` | Add AND condition |
| `or(field, operator, value)` | Add OR condition |
| `innerJoin(table, left, right)` | Add INNER JOIN |
| `leftJoin(table, left, right)` | Add LEFT JOIN |
| `groupBy(...fields)` | Group results by fields |
| `having(field, operator, value)` | Add HAVING condition |
| `orderBy(field, direction)` | Sort results |
| `limit(count)` | Limit result count |
| `offset(count)` | Skip records |
| `set(data)` | Set data for UPDATE |
| `execute()` | Execute query *(optional"")* |

#### Aggregation Methods

| Method | Description |
|--------|-------------|
| `count(alias?)` | Count records |
| `sum(field, alias?)` | Sum field values |
| `avg(field, alias?)` | Average field values |
| `min(field, alias?)` | Minimum field value |
| `max(field, alias?)` | Maximum field value |

## Browser Support

- Chrome 24+
- Firefox 16+
- Safari 8+
- Edge 12+
- IE 10+

## Performance Tips

1. **Use Indexes**: Create indexes for frequently queried fields
2. **Batch Operations**: Use bulk operations for large datasets
3. **Enable Caching**: Configure appropriate cache size and TTL
4. **Connection Pooling**: Reuse database connections
5. **Lazy Loading**: Use pagination for large result sets
6. **Transaction Batching**: Group related operations in transactions

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Changelog

### v1.0.0
- Initial release
- SQL-like query interface
- JOIN support
- Aggregation functions
- Caching system
- Transaction support
- Migration system
- Background sync
- Bulk operations
