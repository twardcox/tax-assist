# Data Dictionary Maintenance Guide

## Purpose

Ensure `DATA_DICTIONARY.md` remains the single source of truth for all database schemas, data structures, and data quality information.

---

## When to Update

**ALWAYS** update `DATA_DICTIONARY.md` when any of the following occur:

### 1. New Data Discovery

- First time querying a new table
- Discovering new columns in existing tables
- Finding new data sources (APIs, databases, etc.)
- Identifying new table relationships or foreign keys

### 2. Schema Changes

- Column data type changes
- New constraints or validation rules
- Changes to primary/foreign keys
- Modified enum values or status codes

### 3. Data Quality Issues

- Missing or null data patterns
- Data freshness gaps or lags
- Inconsistencies between related tables
- Known bugs or quirks in data
- Date format or parsing issues

### 4. Usage Patterns

- New query patterns that work well
- SQL examples that solve common problems
- Best practices for specific tables
- Performance optimization techniques

### 5. Business Rules

- Client categorization rules
- Status code mappings
- Calculation formulas
- Data filtering criteria

---

## How to Update

### Update Process

1. Edit the relevant section in `DATA_DICTIONARY.md`
2. Add an entry to the Update Log at the bottom
3. Include context: Why this matters, what changed, impact on queries

### Documentation Standards

- **Be specific:** Include exact column names, data types, and example values
- **Include examples:** Show SQL queries demonstrating the pattern
- **Note caveats:** Document edge cases, known issues, limitations
- **Link related info:** Reference other tables, reports, or code that uses this data

---

## Template for New Table Documentation

```
### table_name

**Purpose**: Brief description of what this table contains and its business purpose

**Key Columns**:

| Column     | Type   | Description        | Notes                           |
| ---------- | ------ | ------------------ | ------------------------------- |
| id         | STRING | Primary identifier |                                 |
| name       | STRING | Display name       | Can be null for deleted records |
| created_at | STRING | Creation timestamp |                                 |

**Usage Notes**:

- Important filter conditions
- Known data quality issues
- Relationships to other tables
- Performance considerations

**Example Query**:

SELECT col1, col2
FROM table_name
WHERE condition
LIMIT 10
```

---

## Enforcement

**Before completing any task that involves data:**

1. Ask yourself: "Did I learn anything new about the data?"
2. Check: "Would this information help someone else querying this table?"
3. Verify: "Is this already documented in DATA_DICTIONARY.md?"
4. If NO to #3, update the dictionary BEFORE marking the task complete

**Proactive reminders:**

- When reading/writing data layer code → Check if dictionary is current
- When debugging data issues → Document the issue and solution
- When a query returns unexpected results → Document the cause
- After exploring new tables → Document the structure immediately

---

## Success Criteria

- Data Dictionary is always up-to-date
- New team members can understand data structure from reading it
- Reduces time spent re-discovering the same information
- Serves as reliable reference during code reviews
- Documents institutional knowledge about data quirks
