import sqlite3
import sys

def show_memories(db_path='memori.db', limit=50):
    """Display memories from the SQLite database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get total count
    cursor.execute('SELECT COUNT(*) FROM memories')
    total = cursor.fetchone()[0]
    print(f"\n{'='*80}")
    print(f"MEMORY DATABASE: {db_path}")
    print(f"Total memories: {total}")
    print(f"{'='*80}\n")
    
    # Get memories grouped by story
    cursor.execute('''
        SELECT story_id, COUNT(*) as count 
        FROM memories 
        GROUP BY story_id 
        ORDER BY count DESC
    ''')
    stories = cursor.fetchall()
    
    for story_id, count in stories:
        print(f"\n📖 STORY: {story_id}")
        print(f"   Memories: {count}")
        print("-" * 70)
        
        # Get memories for this story
        cursor.execute('''
            SELECT memory_id, category, content, created_at 
            FROM memories 
            WHERE story_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        ''', (story_id, limit))
        
        memories = cursor.fetchall()
        for mem_id, category, content, created in memories:
            cat = category or 'note'
            # Truncate long content
            display = content[:80] + '...' if len(content) > 80 else content
            display = display.replace('\n', ' ')
            print(f"   [{cat:12}] {display}")
    
    conn.close()
    print(f"\n{'='*80}\n")

if __name__ == '__main__':
    db = sys.argv[1] if len(sys.argv) > 1 else 'memori.db'
    show_memories(db)
